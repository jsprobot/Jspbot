import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { advanceSprite, decideLineAction, isOnLine } from '../js/lesson-core.js';

test('two-sensor algorithm handles every state and a prolonged loss', () => {
  assert.equal(decideLineAction(true, true), 'straight');
  assert.equal(decideLineAction(true, false), 'left');
  assert.equal(decideLineAction(false, true), 'right');
  assert.equal(decideLineAction(false, false, 'left', 100), 'search-left');
  assert.equal(decideLineAction(false, false, 'right', 100), 'search-right');
  assert.equal(decideLineAction(false, false, 'right', 2000), 'stop');
});

test('sprite exercise starts on the line and moves in finite steps inside the stage', () => {
  assert.equal(isOnLine(0,96), true);
  assert.equal(isOnLine(0,0), false);
  let pose = {x:0,y:96,heading:0};
  let detected = false, searching = false;
  for(let i=0;i<1500;i++) {
    pose=advanceSprite(pose);
    detected ||= pose.onLine;
    searching ||= !pose.onLine;
    assert.ok([pose.x,pose.y,pose.heading].every(Number.isFinite));
    assert.ok(Math.abs(pose.x)<225 && Math.abs(pose.y)<165);
  }
  assert.ok(detected && searching);
});

test('native mBlock file has intact assets, blocks, parent links and the requested algorithm', () => {
  const script = `import json,zipfile,hashlib
from pathlib import Path
p=Path('downloads/S1_suivi_ligne_JSPRobot.mblock')
with zipfile.ZipFile(p) as z:
 assert z.testzip() is None
 assert 'mblock5' in z.namelist() and 'mscratch.json' in z.namelist()
 j=json.loads(z.read('project.json'))
 assert len(j['targets'])==2 and j['targets'][0]['isStage']
 sprite=j['targets'][1]
 assert sprite['deviceId'] is None and sprite['name']=='JSP'
 blocks=sprite['blocks']
 for t in j['targets']:
  for c in t['costumes']:
   raw=z.read(c['md5ext']); assert hashlib.md5(raw).hexdigest()==c['assetId']
 for key,b in blocks.items():
  for other in [b.get('parent'),b.get('next')]:
   assert other is None or other in blocks
 assert blocks['start']['opcode']=='event_whenflagclicked'
 assert blocks['loop']['opcode']=='control_forever'
 assert blocks['condition']['opcode']=='control_if_else'
 assert blocks['on-line']['inputs']['COLOR'][1][1]=='#000000'
 assert blocks['turn']['opcode']=='motion_turnright'
 print('Native archive structure verified')`;
  assert.match(execFileSync('python3',['-c',script],{cwd:new URL('..',import.meta.url),encoding:'utf8'}),/verified/);
});
