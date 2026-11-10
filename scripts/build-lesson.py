"""Build the mBlock 5 sprite exercise and the two-sensor lesson notes.

The downloadable .mblock is a Scratch-stage project with two virtual colored
sensor dots. It is not firmware for the physical Me Auriga robot.
"""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "downloads"
DEST.mkdir(exist_ok=True)

backdrop = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#ffffff"/><ellipse cx="240" cy="180" rx="156" ry="96" fill="none" stroke="#000000" stroke-width="14"/></svg>'
sprite = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="28" viewBox="0 0 32 28"><path d="M2 4 L24 14 L2 24 L8 14Z" fill="#1267b2" stroke="#084b88"/><circle cx="28" cy="7" r="2.6" fill="#ff4b45"/><circle cx="28" cy="21" r="2.6" fill="#4de573"/></svg>'

def costume(name, svg, center):
    digest = hashlib.md5(svg.encode()).hexdigest()
    return {"name": name, "bitmapResolution": 1, "dataFormat": "svg",
            "assetId": digest, "md5ext": digest + ".svg",
            "rotationCenterX": center[0], "rotationCenterY": center[1]}

def block(opcode, parent=None, next_id=None, inputs=None, fields=None, top=False):
    value = {"opcode": opcode, "next": next_id, "parent": parent,
             "inputs": inputs or {}, "fields": fields or {}, "shadow": False, "topLevel": top}
    if top:
        value.update(x=80, y=60)
    return value

def sense(parent, color):
    return block("sensing_coloristouchingcolor", parent, inputs={
        "COLOR": [1, [9, color]], "COLOR2": [1, [9, "#000000"]]})

def move(parent, steps, next_id=None):
    return block("motion_movesteps", parent, next_id,
                 {"STEPS": [1, [4, str(steps)]]})

def turn(parent, side, degrees=3, next_id=None):
    return block("motion_turnleft" if side == "left" else "motion_turnright",
                 parent, next_id, {"DEGREES": [1, [4, str(degrees)]]})

VARIABLE = "Dernier virage"
blocks = {
    "start": block("event_whenflagclicked", next_id="position", top=True),
    "position": block("motion_gotoxy", "start", "direction",
                      {"X": [1, [4, "0"]], "Y": [1, [4, "96"]]}),
    "direction": block("motion_pointindirection", "position", "remember-start",
                       {"DIRECTION": [1, [8, "90"]]}),
    "remember-start": block("data_setvariableto", "direction", "loop",
                            {"VALUE": [1, [10, "droite"]]},
                            {"VARIABLE": [VARIABLE, "last-direction"]}),
    "loop": block("control_forever", "remember-start",
                  inputs={"SUBSTACK": [2, "if-both"]}),
    "if-both": block("control_if_else", "loop", inputs={
        "CONDITION": [2, "both"], "SUBSTACK": [2, "move-forward"], "SUBSTACK2": [2, "if-left"]}),
    "both": block("operator_and", "if-both", inputs={
        "OPERAND1": [2, "sense-both-left"], "OPERAND2": [2, "sense-both-right"]}),
    "sense-both-left": sense("both", "#ff4b45"),
    "sense-both-right": sense("both", "#4de573"),
    "move-forward": move("if-both", 2),
    "if-left": block("control_if_else", "if-both", inputs={
        "CONDITION": [2, "sense-left"], "SUBSTACK": [2, "turn-left"], "SUBSTACK2": [2, "if-right"]}),
    "sense-left": sense("if-left", "#ff4b45"),
    "turn-left": turn("if-left", "left", 3, "remember-left"),
    "remember-left": block("data_setvariableto", "turn-left", "move-left",
                           {"VALUE": [1, [10, "gauche"]]},
                           {"VARIABLE": [VARIABLE, "last-direction"]}),
    "move-left": move("remember-left", 2),
    "if-right": block("control_if_else", "if-left", inputs={
        "CONDITION": [2, "sense-right"], "SUBSTACK": [2, "turn-right"], "SUBSTACK2": [2, "if-search"]}),
    "sense-right": sense("if-right", "#4de573"),
    "turn-right": turn("if-right", "right", 3, "remember-right"),
    "remember-right": block("data_setvariableto", "turn-right", "move-right",
                            {"VALUE": [1, [10, "droite"]]},
                            {"VARIABLE": [VARIABLE, "last-direction"]}),
    "move-right": move("remember-right", 2),
    "if-search": block("control_if_else", "if-right", next_id="move-search", inputs={
        "CONDITION": [2, "is-left"], "SUBSTACK": [2, "search-left"], "SUBSTACK2": [2, "search-right"]}),
    "is-left": block("operator_equals", "if-search", inputs={
        "OPERAND1": [3, "direction-value", [10, ""]],
        "OPERAND2": [1, [10, "gauche"]]}),
    "direction-value": block("data_variable", "is-left",
                             fields={"VARIABLE": [VARIABLE, "last-direction"]}),
    "search-left": turn("if-search", "left"),
    "search-right": turn("if-search", "right"),
    "move-search": move("if-search", 1),
}
common = {"variables": {}, "lists": {}, "broadcasts": {}, "comments": {},
          "currentCostume": 0, "sounds": [], "volume": 100}
stage_costume = costume("Piste ovale noire", backdrop, (240, 180))
sprite_costume = costume("JSP deux capteurs", sprite, (16, 14))
stage = {**common, "isStage": True, "name": "Stage", "blocks": {},
         "costumes": [stage_costume], "tempo": 60, "videoTransparency": 50,
         "videoState": "off", "textToSpeechLanguage": None}
actor = {**common, "isStage": False, "name": "JSP", "blocks": blocks,
         "variables": {"last-direction": [VARIABLE, "droite"]},
         "costumes": [sprite_costume], "visible": True, "x": 0, "y": 96,
         "size": 100, "direction": 90, "draggable": False,
         "rotationStyle": "all around",
         "deviceId": None, "loadedExtIds": [], "editorMode": "block",
         "codes": None, "codeTypes": []}
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
        info = ZipInfo(name, date_time=(2026, 11, 10, 0, 0, 0))
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
Correction droite : moteur droit plus lent que le gauche.
Le programme mBlock S1 anime un sprite avec des capteurs de couleur.
Ce fichier S2 décrit les vrais capteurs infrarouges : les ports et vitesses
sont à vérifier avant d'utiliser le robot physique.
"""
(DEST / "S2_algorithme_JSPRobot.txt").write_text(algorithm, encoding="utf-8")
print(f"Built {target.name} ({target.stat().st_size} bytes)")
