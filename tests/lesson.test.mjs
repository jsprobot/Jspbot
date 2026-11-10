import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { advanceSprite, decideLineAction, isOnLine, readSpriteSensors } from '../js/lesson-core.js';

test('two-sensor algorithm handles every state and a prolonged loss', () => {
  assert.equal(decideLineAction(true, true), 'straight');
  assert.equal(decideLineAction(true, false), 'left');
  assert.equal(decideLineAction(false, true), 'right');
  assert.equal(decideLineAction(false, false, 'left', 100), 'search-left');
  assert.equal(decideLineAction(false, false, 'right', 100), 'search-right');
  assert.equal(decideLineAction(false, false, 'right', 2000), 'stop');
});

test('two color probes can request corrections in both directions', () => {
  assert.equal(isOnLine(0, 96), true);
  assert.equal(isOnLine(0, 0), false);
  const right = readSpriteSensors({ x: 0, y: 83, heading: 0 });
  const left = readSpriteSensors({ x: 0, y: 109, heading: 0 });
  assert.notDeepEqual(right, left);
  assert.equal(decideLineAction(true, false), 'left');
  assert.equal(decideLineAction(false, true), 'right');
});

test('sprite follows the whole oval for multiple laps rather than drifting away', () => {
  let pose = { x: 0, y: 96, heading: 0, lastDirection: 'right' };
  const points = [];
  for (let i = 0; i < 5000; i++) {
    pose = advanceSprite(pose, 2, 3);
    points.push(pose);
    assert.ok([pose.x, pose.y, pose.heading].every(Number.isFinite));
    assert.ok(Math.abs(pose.x) < 170 && Math.abs(pose.y) < 110);
    const level = (pose.x / 156) ** 2 + (pose.y / 96) ** 2;
    assert.ok(level > 0.75 && level < 1.25, 'sprite has left the oval track');
  }
  assert.ok(Math.min(...points.map(p => p.x)) < -140);
  assert.ok(Math.max(...points.map(p => p.x)) > 140);
  assert.ok(Math.min(...points.map(p => p.y)) < -85);
  assert.ok(Math.max(...points.map(p => p.y)) > 85);
  assert.ok(points.some(p => p.action === 'right'));
});

test('native mBlock file has two colored line sensors and both turn directions', () => {
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
 assert 'last-direction' in sprite['variables']
 blocks=sprite['blocks']
 for target in j['targets']:
  for c in target['costumes']:
   raw=z.read(c['md5ext']); assert hashlib.md5(raw).hexdigest()==c['assetId']
 for key,b in blocks.items():
  for other in [b.get('parent'),b.get('next')]:
   assert other is None or other in blocks, (key,other)
  for v in b.get('inputs',{}).values():
   if len(v)>1 and isinstance(v[1],str):assert v[1] in blocks, (key,v)
 assert blocks['start']['opcode']=='event_whenflagclicked'
 assert blocks['loop']['opcode']=='control_forever'
 assert any(b['opcode']=='operator_and' for b in blocks.values())
 assert any(b['opcode']=='motion_turnleft' for b in blocks.values())
 assert any(b['opcode']=='motion_turnright' for b in blocks.values())
 senses=[b for b in blocks.values() if b['opcode']=='sensing_coloristouchingcolor']
 assert len(senses)>=4
 assert {b['inputs']['COLOR'][1][1] for b in senses}=={'#ff4b45','#4de573'}
 assert all(b['inputs']['COLOR2'][1][1]=='#000000' for b in senses)
 print('Native archive and two color probes verified')`;
  assert.match(execFileSync('python3',['-c',script],{cwd:new URL('..',import.meta.url),encoding:'utf8'}),/verified/);
});
