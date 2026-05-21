// Cost lever E — per-archetype principles cached as a separate breakpoint.
// Each block is ~800 tokens. Cached at 1h independently from the universal
// CODE_SYSTEM_PROMPT and from the per-archetype template HTML. Since these are stable
// across calls within an archetype but the universal prompt is stable across ALL calls,
// splitting them lets the cache breakpoints align more tightly. Target: code-call
// cache-read ratio 61% → 85%.

import type { ArchetypeId } from '../schemas/archetypes.ts';

const LANE_RACER_PRINCIPLES = `# Lane racer principles

You are writing a 3-lane top-down racer. The player's car drives forward continuously;
tap left half → swap one lane left, right half → swap one lane right. Question gates
appear ahead in random lanes — driving through the correct lane scores.

Required juice (call these GameFeel methods at minimum once each):
- GameFeel.audio.engineRev on every level-up (also one engine rev at game start)
- GameFeel.burst with smoke colors on every lane switch (tire smoke puff)
- GameFeel.scorePopup '+1 MPH' on the player car on every correct answer
- GameFeel.shake(scene, 4, 220) + GameFeel.audio.impact on every wrong (mild crash)
- GameFeel.parallaxLayer for the road tile scroll (already in the template)
- GameFeel.audio.correctChain for combo audio (semitone rises per consecutive correct)

Visual signature: 3-5 ambient rival cars passing in other lanes (no collision logic),
lane-divider dashes that scroll with the road, speed lines on the sides at high speed.

Speed scales 110 / 140 / 170 / 200 / 230 px/sec across levels 1-5. NEVER demand reflex
reactions under 1 second to a gate. Difficulty is content depth, not reaction time.

Audio palette: engine rev (ascending sawtooth) on level-up; combo chain on correct;
woosh on lane switch; impact thud on crash. Never blast the player.
`;

const GOAL_SHOOTOUT_PRINCIPLES = `# Goal shootout principles

You are writing a shooting-style game. 4 target panels at the top of the screen; player +
ball at the bottom. Tap a target to "kick" the ball at it. The keeper dives toward (wrong
= correct lane / right = wrong lane). Net ripples on goal.

Required juice:
- GameFeel.audio.crowdCheer at the start of every level + on every goal
- GameFeel.confetti from the goal frame on every correct answer
- GameFeel.scorePopup 'GOAL! +10' on goal
- GameFeel.zoomPunch(scene, 0.06, 320) on goal celebration
- GameFeel.audio.woosh on the kick
- GameFeel.audio.impact on a save (no harsh thud — just a soft block sound)

Visual signature: animated crowd in stands (Mexican-wave color shifts), pulsing stadium
lights, net rope grid that sine-displaces on goal, ambient stadium murmur loop every
~4.5s. Ball tweens along an arc with rotation during flight.

Audio palette: crowd cheer (filtered noise); woosh on kick; impact on save; combo chain
on consecutive correct.
`;

const TOWER_BUILDER_PRINCIPLES = `# Tower builder principles

You are writing a stacking game. Player taps ingredient blocks to stack them onto a
tower base. Multiset equality check on the answer. Wrong stacks wobble and a block
tumbles off; correct stacks land with a satisfying thunk.

Required juice:
- GameFeel.audio.impact on every block landing (the satisfying thunk)
- GameFeel.squashStretch on the landed block (deformation on impact)
- GameFeel.burst with construction-dust colors on every block-land
- GameFeel.parallaxLayer for the drifting clouds backdrop
- GameFeel.wobble on the entire tower stack on wrong answer
- GameFeel.scorePopup '+10' on correct stack-complete
- Height meter on the right side that animates as the tower grows
- "NEW RECORD" banner with bounceIn when the new height beats previousBest

Visual signature: sky gradient + drifting clouds parallax, 4-5 distant mountain
silhouettes, ambient dust puffs at the base (every ~1.4s), wind-woosh ambient loop.

Audio palette: thunk impact on land; impact (low) on wrong; ambient wind woosh every
~1.5s; combo chain on consecutive correct.
`;

const QUEST_PATH_PRINCIPLES = `# Quest path principles

You are writing a side-scrolling story game. A hero walks along a path. At each fork
a multi-step question appears in a typewriter dialog box. Picking right = hero walks
onward; picking wrong = "DEAD END" reveal then route correction.

Required juice:
- GameFeel.audio.woosh on every forward step
- GameFeel.audio.swordSlash on the dramatic Level 5 boss intro
- GameFeel.flash + GameFeel.shake on the boss-room reveal
- GameFeel.trail attached to the hero's permanent sparkle trail
- GameFeel.scorePopup '+10' on correct branch chosen
- GameFeel.squashStretch on the hero on forward step (small bounce)
- GameFeel.parallaxLayer for foreground silhouette trees
- GameFeel.bounceIn on the fork signpost appearance

Per-level environment changes: forest → cave → mountain → castle → boss room. Sky tint
shifts visibly each level. Level 5 (boss room) gets the dramatic intro (white flash,
6-intensity shake, 0.12 zoomPunch).

Typewriter dialog: 30 ms/char, skippable on tap.

Audio palette: woosh on walk; sword slash on boss reveal; impact (low) on wrong-path;
combo chain on correct.
`;

export function principlesFor(archetype: ArchetypeId | null): string {
  switch (archetype) {
    case 'lane_racer': return LANE_RACER_PRINCIPLES;
    case 'goal_shootout': return GOAL_SHOOTOUT_PRINCIPLES;
    case 'tower_builder': return TOWER_BUILDER_PRINCIPLES;
    case 'quest_path': return QUEST_PATH_PRINCIPLES;
    default: return '';
  }
}
