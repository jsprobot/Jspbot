"""Build a native mBlock 5 sprite exercise with original SVG assets."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "downloads"
DEST.mkdir(exist_ok=True)

backdrop = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#ffffff"/><ellipse cx="240" cy="180" rx="156" ry="96" fill="none" stroke="#000000" stroke-width="14"/></svg>'
sprite = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 32 24"><path d="M29 12 4 2 9 12 4 22Z" fill="#4c6eaa"/><circle cx="15" cy="12" r="3" fill="#49765f"/></svg>'

def costume(name, svg, center):
    digest = hashlib.md5(svg.encode()).hexdigest()
    return {"name": name, "bitmapResolution": 1, "dataFormat": "svg",
            "assetId": digest, "md5ext": digest + ".svg",
            "rotationCenterX": center[0], "rotationCenterY": center[1]}

def block(opcode, parent=None, next_id=None, inputs=None, top=False):
    value = {"opcode": opcode, "next": next_id, "parent": parent,
             "inputs": inputs or {}, "fields": {}, "shadow": False, "topLevel": top}
    if top:
        value.update(x=80, y=60)
    return value

blocks = {
    "start": block("event_whenflagclicked", next_id="position", top=True),
    "position": block("motion_gotoxy", "start", "direction",
                      {"X": [1, [4, "0"]], "Y": [1, [4, "96"]]}),
    "direction": block("motion_pointindirection", "position", "loop",
                       {"DIRECTION": [1, [8, "90"]]}),
    "loop": block("control_forever", "direction", inputs={"SUBSTACK": [2, "condition"]}),
    "condition": block("control_if_else", "loop", inputs={
        "CONDITION": [2, "on-line"], "SUBSTACK": [2, "advance"], "SUBSTACK2": [2, "turn"]}),
    "on-line": block("sensing_touchingcolor", "condition", inputs={"COLOR": [1, [9, "#000000"]]}),
    "advance": block("motion_movesteps", "condition", inputs={"STEPS": [1, [4, "2"]]}),
    "turn": block("motion_turnright", "condition", "search",
                  {"DEGREES": [1, [4, "2"]]}),
    "search": block("motion_movesteps", "turn", inputs={"STEPS": [1, [4, "1"]]}),
}

common = {"variables": {}, "lists": {}, "broadcasts": {}, "comments": {},
          "currentCostume": 0, "sounds": [], "volume": 100}
stage_costume = costume("Ligne noire", backdrop, (240, 180))
sprite_costume = costume("JSP", sprite, (16, 12))
stage = {**common, "isStage": True, "name": "Stage", "blocks": {},
         "costumes": [stage_costume], "tempo": 60, "videoTransparency": 50,
         "videoState": "off", "textToSpeechLanguage": None}
actor = {**common, "isStage": False, "name": "JSP", "blocks": blocks,
         "costumes": [sprite_costume], "visible": True, "x": 0, "y": 96,
         "size": 100, "direction": 90, "draggable": False, "rotationStyle": "all around",
         "deviceId": None, "loadedExtIds": [], "editorMode": "block", "codes": None,
         "codeTypes": []}
project = {"targets": [stage, actor], "monitors": [], "extensions": [],
           "meta": {"semver": "3.0.0", "vm": "2.0.14", "agent": "JSP Robot"}}
state = {"spritesState": {
    "jsp-stage": {"id": "jsp-stage", "name": "Stage", "deviceId": None,
                  "codeTypes": [], "editorMode": "block", "isEditing": False},
    "jsp-sprite": {"id": "jsp-sprite", "name": "JSP", "deviceId": None,
                   "codeTypes": [], "editorMode": "block", "isEditing": True}},
    "extensions": {}}
entries = {
    "project.json": json.dumps(project, ensure_ascii=False, separators=(",", ":")),
    "mscratch.json": json.dumps(state, separators=(",", ":")),
    "mblock5": json.dumps({"version": "5.6.1"}),
    stage_costume["md5ext"]: backdrop,
    sprite_costume["md5ext"]: sprite,
}
target = DEST / "S1_suivi_ligne_JSPRobot.mblock"
with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
    for name, contents in entries.items():
        info = ZipInfo(name, date_time=(2026, 11, 3, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, contents.encode())

algorithm = """JSP Robot — Devoir pour la séance 2
Algorithme proposé : deux capteurs infrarouges sur une ligne noire, fond blanc.

Au départ, mémoriser une direction de recherche (gauche par défaut).
Répéter indéfiniment :
  Lire le capteur gauche et le capteur droit.
  Si les deux détectent la ligne :
    Avancer tout droit et réinitialiser le temps de perte.
  Sinon, si seul le capteur gauche détecte la ligne :
    Corriger vers la gauche et mémoriser cette direction.
  Sinon, si seul le capteur droit détecte la ligne :
    Corriger vers la droite et mémoriser cette direction.
  Sinon :
    Chercher lentement la ligne dans la dernière direction mémorisée.
    Si la ligne reste perdue pendant 2 secondes : arrêter les moteurs.
    Repositionner le robot sur la ligne avant de recommencer.

Correction gauche : moteur gauche plus lent que le moteur droit.
Correction droite : moteur droit plus lent que le moteur gauche.
La durée de recherche et les vitesses sont des réglages proposés,
à vérifier lors des essais sur le robot réel.
"""
(DEST / "S2_algorithme_JSPRobot.txt").write_text(algorithm, encoding="utf-8")
print(f"Built {target.name} ({target.stat().st_size} bytes)")
