from __future__ import annotations

import io
import re
from dataclasses import dataclass

import chess
import chess.engine
import chess.pgn
import chess.polyglot
import chess.syzygy

from sentinel.config import settings
from sentinel.schemas import GameInput, MoveInput

CLK_RE = re.compile(r"\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]")


def _parse_clock_seconds(comment: str) -> float | None:
    m = CLK_RE.search(comment or "")
    if not m:
        return None
    h, mm, ss = m.groups()
    return float(h) * 3600 + float(mm) * 60 + float(ss)


def _cp(score: chess.engine.PovScore) -> float:
    return float(score.relative.score(mate_score=10000) or 0.0)


@dataclass
class EngineContext:
    engine: chess.engine.SimpleEngine
    book: chess.polyglot.MemoryMappedReader | None
    tablebase: chess.syzygy.Tablebase | None

    def close(self) -> None:
        self.engine.quit()
        if self.book is not None:
            self.book.close()
        if self.tablebase is not None:
            self.tablebase.close()


def create_engine_context() -> EngineContext:
    if not settings.stockfish_path:
        raise ValueError("STOCKFISH_PATH is required for PGN analysis")

    engine = chess.engine.SimpleEngine.popen_uci(settings.stockfish_path)
    book = chess.polyglot.open_reader(settings.polyglot_book_path) if settings.polyglot_book_path else None
    tablebase = chess.syzygy.open_tablebase(settings.syzygy_path) if settings.syzygy_path else None
    return EngineContext(engine=engine, book=book, tablebase=tablebase)


def parse_pgn_games(pgn_text: str) -> list[chess.pgn.Game]:
    stream = io.StringIO(pgn_text)
    games: list[chess.pgn.Game] = []
    while True:
        g = chess.pgn.read_game(stream)
        if g is None:
            break
        games.append(g)
    return games


def _is_book_position(board: chess.Board, book: chess.polyglot.MemoryMappedReader | None) -> bool:
    if book is None:
        return False
    try:
        return any(True for _ in book.find_all(board))
    except Exception:
        return False


def _is_tablebase_position(board: chess.Board, tb: chess.syzygy.Tablebase | None) -> bool:
    if tb is None:
        return len(board.piece_map()) <= 7
    return len(board.piece_map()) <= 7


def _analyse_position(
    board: chess.Board,
    move: chess.Move,
    ctx: EngineContext,
) -> tuple[float, bool, int, float, float, str, float, float]:
    legal_count = board.legal_moves.count()
    if legal_count <= 1:
        return 0.0, True, 1, 10000.0, 0.0, move.uci(), 0.0, 0.0

    limit = chess.engine.Limit(depth=settings.analysis_depth)
    info = ctx.engine.analyse(board, limit, multipv=max(2, settings.multipv))
    if not isinstance(info, list):
        info = [info]
    info = sorted(info, key=lambda x: x.get("multipv", 1))

    best_move = info[0]["pv"][0]
    best_score = _cp(info[0]["score"])
    second_score = _cp(info[1]["score"]) if len(info) > 1 else best_score - 10000.0
    gap = best_score - second_score

    played_score_obj = ctx.engine.analyse(board, limit, root_moves=[move])
    played_score = _cp(played_score_obj["score"])
    cp_loss = max(0.0, best_score - played_score)

    top_moves = [line["pv"][0] for line in info[:3] if "pv" in line and line["pv"]]
    top3_match = move in top_moves

    candidate_count = 0
    for line in info:
        if "score" not in line:
            continue
        if (best_score - _cp(line["score"])) <= 50.0:
            candidate_count += 1
    candidate_count = max(1, candidate_count)
    forced = gap > settings.forced_move_gap_cp
    eval_swing_cp = max(0.0, gap)
    return cp_loss, top3_match, candidate_count, gap, eval_swing_cp, best_move.uci(), best_score, played_score


def game_to_inputs(game: chess.pgn.Game, game_id: str, player_color: str, ctx: EngineContext) -> GameInput:
    board = game.board()
    node = game
    moves: list[MoveInput] = []
    last_clock = {chess.WHITE: None, chess.BLACK: None}
    ply = 0

    desired_color = chess.WHITE if player_color.lower() == "white" else chess.BLACK
    while node.variations:
        next_node = node.variation(0)
        move = next_node.move
        ply += 1
        side_to_move = board.turn

        comment = next_node.comment or ""
        clk = _parse_clock_seconds(comment)
        spent = None
        prev = last_clock[side_to_move]
        if prev is not None and clk is not None and prev >= clk:
            spent = prev - clk
        if clk is not None:
            last_clock[side_to_move] = clk

        is_book = _is_book_position(board, ctx.book)
        is_tb = _is_tablebase_position(board, ctx.tablebase)

        cp_loss = 0.0
        top3_match = False
        candidates = 1
        gap = 0.0
        eval_swing = 0.0
        best_uci = move.uci()
        best_eval_cp = 0.0
        played_eval_cp = 0.0

        if side_to_move == desired_color:
            cp_loss, top3_match, candidates, gap, eval_swing, best_uci, best_eval_cp, played_eval_cp = _analyse_position(
                board, move, ctx
            )

            moves.append(
                MoveInput(
                    ply=ply,
                    engine_best=best_uci,
                    player_move=move.uci(),
                    cp_loss=cp_loss,
                    top3_match=top3_match,
                    complexity_score=candidates,
                    candidate_moves_within_50cp=candidates,
                    best_second_gap_cp=max(0.0, gap),
                    eval_swing_cp=eval_swing,
                    best_eval_cp=best_eval_cp,
                    played_eval_cp=played_eval_cp,
                    is_opening_book=is_book,
                    is_tablebase=is_tb,
                    is_forced=(gap > settings.forced_move_gap_cp),
                    time_spent_seconds=spent,
                )
            )

        board.push(move)
        node = next_node

    return GameInput(game_id=game_id, moves=moves)
