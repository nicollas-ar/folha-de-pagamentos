import secrets
import time
from flask import Blueprint, g, session, render_template, jsonify, request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from ..models import User, MazeScore, now
from ..security import login_required

bp = Blueprint('maze', __name__)

def leaderboard():
    rows = g.db.execute(select(User.name, MazeScore.score, MazeScore.user_id)
        .join(User, User.id == MazeScore.user_id).where(User.active.is_(True))
        .order_by(MazeScore.score.desc(), MazeScore.updated_at, User.id).limit(30)).all()
    return [{'name': r.name, 'score': r.score, 'me': r.user_id == g.user.id} for r in rows]

@bp.get('/labirinto')
@login_required
def game():
    return render_template('maze.html', ranking=leaderboard())

@bp.post('/labirinto/start')
@login_required
def start():
    token = secrets.token_urlsafe(24)
    session['maze_run'] = {'token': token, 'start': time.time(), 'uid': g.user.id}
    return jsonify(token=token)

@bp.post('/labirinto/score')
@login_required
def score():
    data = request.get_json(silent=True) or {}
    run = session.get('maze_run', {})
    points = data.get('score')
    elapsed = time.time() - run.get('start', time.time())
    if (run.get('uid') != g.user.id or not isinstance(data.get('token'), str)
        or not secrets.compare_digest(data['token'], run.get('token',''))
        or type(points) is not int or points < 0 or points > 100000
        or elapsed < 0 or elapsed > 900 or points > int(elapsed * 180) + 200):
        return jsonify(error='Partida inválida ou expirada. Inicie outra corrida.'), 400
    session.pop('maze_run', None)
    insert = pg_insert if g.db.bind.dialect.name == 'postgresql' else sqlite_insert
    stmt = insert(MazeScore).values(user_id=g.user.id, score=points, updated_at=now())
    stmt = stmt.on_conflict_do_update(index_elements=['user_id'],
        set_={'score': points, 'updated_at': now()}, where=MazeScore.score < points)
    g.db.execute(stmt)
    g.db.commit()
    best = g.db.get(MazeScore, g.user.id)
    return jsonify(best=best.score, ranking=leaderboard())


@bp.get('/arena')
@login_required
def arena():
    return render_template('fighters.html')
