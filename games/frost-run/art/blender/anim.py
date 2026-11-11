"""The eleven clips every hero has, written once and played on any rig through its roles.

A rig names which bones do what (root, body, head, eyes, feet or legs, arms, wings, tails...).
Each clip is a pose function of t (0..1) built from those roles, so a ram, a dragon and a miner
all idle, run, hop, duck, roll, hover, shoot, get hit, win, lose and pose for the select screen.

Axis notes (Blender, roll 0, the character faces -Y):
  an upward bone:   +rot X leans it forward, +rot Z tips it to the character's right, rot Y twists it;
                    its scale y is its height (squash and stretch), z its depth
  a downward bone:  +rot X swings its end backward, -rot X forward
  a forward bone:   +rot X lifts its tip, location y is forward and z is up
"""
import math

import lib

TAU = math.tau


def s(t, phase=0.0):
    return math.sin(TAU * (t + phase))


def c(t, phase=0.0):
    return math.cos(TAU * (t + phase))


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def bump(t, start, end):
    """0 outside [start, end], rising to 1 and back inside it."""
    if t <= start or t >= end:
        return 0.0
    return math.sin(math.pi * (t - start) / (end - start))


def merge_pose(*poses):
    out = {}
    for pose in poses:
        for bone, spec in pose.items():
            cur = out.setdefault(bone, {})
            for key, val in spec.items():
                if key == "scale":
                    old = cur.get(key, (1, 1, 1))
                    cur[key] = tuple(a * b for a, b in zip(old, val))
                else:
                    old = cur.get(key, (0, 0, 0))
                    cur[key] = tuple(a + b for a, b in zip(old, val))
    return out


class Rig:
    def __init__(self, roles):
        self.roles = roles

    def has(self, role):
        return bool(self.roles.get(role))

    def get(self, role, default=None):
        return self.roles.get(role, default)


# ------------------------------------------------------------------------------------------ layers


def eyes(rig, open_=1.0):
    return {e: {"scale": (1, max(open_, 0.08), 1)} for e in rig.get("eyes", [])}


def tails(rig, swing_x=0.0, swing_z=0.0, phase=0.0, t=0.0, wave=8.0, follow=1.0):
    """Every chain sways; deeper links lag and swing wider, like cloth or a tail."""
    pose = {}
    for chain in rig.get("tails", []):
        for i, bone in enumerate(chain):
            lag = 0.12 * i
            pose[bone] = {"rot": (swing_x * follow + wave * s(t, phase - lag) * (1 + 0.4 * i), 0, swing_z + 0.6 * wave * c(t, phase - lag))}
    return pose


def legs_stride(rig, t, stride=28.0, lift=0.05, knee=30.0):
    """A walk or run cycle for leg chains [(thigh, shin, foot, side)] or stubby feet [(foot, side)]."""
    pose = {}
    for thigh, shin, foot, side in rig.get("legs", []):
        ph = 0.0 if side > 0 else 0.5
        swing = -stride * s(t, ph)
        bend = knee * max(0.0, c(t, ph)) + 6
        pose[thigh] = {"rot": (swing, 0, 0)}
        if shin:
            pose[shin] = {"rot": (bend, 0, 0)}
        if foot:
            pose[foot] = {"rot": (-bend * 0.5 - swing * 0.3, 0, 0)}
    for foot, side in rig.get("feet", []):
        ph = 0.0 if side > 0 else 0.5
        pose[foot] = {"loc": (0, 0.11 * s(t, ph), lift * max(0.0, c(t, ph))), "rot": (12 * c(t, ph), 0, 0)}
    for thigh, shin, foot, side in rig.get("quad_legs", []):
        ph = 0.0 if side > 0 else 0.5
        swing = -stride * s(t, ph)
        pose[thigh] = {"rot": (swing, 0, 0)}
        if shin:
            pose[shin] = {"rot": (knee * max(0.0, c(t, ph)) + 4, 0, 0)}
    return pose


def arms_swing(rig, t, amount=30.0, spread=8.0):
    pose = {}
    for arm, fore, side in rig.get("arms", []):
        ph = 0.5 if side > 0 else 0.0
        pose[arm] = {"rot": (-amount * s(t, ph), 0, -side * spread)}
        if fore:
            pose[fore] = {"rot": (-20 - 10 * max(0.0, s(t, ph)), 0, 0)}
    return pose


def wings(rig, flap=0.0, fold=0.0):
    pose = {}
    for wing, tip, side in rig.get("wings", []):
        pose[wing] = {"rot": (flap, 0, side * fold)}
        if tip:
            pose[tip] = {"rot": (flap * 0.6, 0, side * fold * 0.5)}
    return pose


# ------------------------------------------------------------------------------------------ clips


def idle(rig):
    def pose(t):
        breath = 0.5 + 0.5 * s(t)
        p = {
            rig.get("body"): {"rot": (2 * s(t, 0.25), 3 * s(t * 0.5), 0)},
            rig.get("head"): {"rot": (-2 * s(t, 0.1), 6 * s(t * 0.5, 0.2), 2 * s(t * 0.5)), "scale": (1 - 0.01 * breath, 1 + 0.025 * breath, 1 - 0.01 * breath)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (6 * s(t, 0.35), 0, 4 * s(t, 0.1))}
        blink = 1.0 - bump(t, 0.62, 0.7)
        p = merge_pose(p, eyes(rig, blink), tails(rig, t=t, wave=6), arms_swing(rig, t * 0.5, amount=4, spread=10), wings(rig, flap=8 * s(t), fold=30))
        for thigh, shin, foot, side in rig.get("legs", []):
            p[thigh] = {"rot": (-3, 0, 0)}
            if shin:
                p[shin] = {"rot": (6, 0, 0)}
        return {k: v for k, v in p.items() if k}
    return pose


def run(rig):
    lean = rig.get("run_lean", 9)
    def pose(t):
        bob = abs(s(t * 2)) * 0.035
        p = {
            rig.get("root"): {"loc": (0, 0, 0)},
            rig.get("body"): {"rot": (lean, 6 * s(t), 0), "loc": (0, 0, bob)},
            rig.get("head"): {"rot": (-lean * 0.5, -4 * s(t), 3 * s(t)), "scale": (1 + 0.03 * c(t * 2), 1 - 0.035 * c(t * 2), 1 + 0.03 * c(t * 2))},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (-14 + 8 * s(t * 2), 0, 0)}
        p = merge_pose(p, legs_stride(rig, t, stride=rig.get("stride", 30)), arms_swing(rig, t, amount=rig.get("arm_swing", 34)),
                       tails(rig, swing_x=22, t=t * 2, wave=10, follow=1.0), wings(rig, flap=10 * s(t * 2), fold=40))
        return {k: v for k, v in p.items() if k}
    return pose


def hop(rig):
    def pose(t):
        squash = bump(t, 0.0, 0.25)
        stretch = bump(t, 0.15, 0.6)
        tuck = ease((t - 0.45) / 0.4)
        p = {
            rig.get("body"): {"rot": (-6 * stretch + 10 * tuck, 0, 0), "loc": (0, 0, -0.06 * squash)},
            rig.get("head"): {"scale": (1 + 0.1 * squash - 0.06 * stretch, 1 - 0.15 * squash + 0.12 * stretch, 1 + 0.1 * squash - 0.06 * stretch)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (-25 * stretch + 15 * tuck, 0, 0)}
        for foot, side in rig.get("feet", []):
            p[foot] = {"loc": (0, -0.03 * tuck, 0.09 * tuck), "rot": (-25 * tuck, 0, 0)}
        for thigh, shin, foot, side in rig.get("legs", []):
            p[thigh] = {"rot": (-40 * tuck, 0, 0)}
            if shin:
                p[shin] = {"rot": (70 * tuck, 0, 0)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (-30 * stretch, 0, -side * (20 + 40 * stretch))}
        p = merge_pose(p, tails(rig, swing_x=12 * stretch, t=t, wave=4), wings(rig, flap=50 * stretch, fold=10), eyes(rig, 1 - 0.5 * squash))
        return {k: v for k, v in p.items() if k}
    return pose


def duck(rig):
    low = rig.get("duck_scale", 0.55)
    def pose(t):
        d = ease(t / 0.6)
        p = {
            rig.get("body"): {"rot": (14 * d, 0, 0), "loc": (0, 0, -0.1 * d)},
            rig.get("head"): {"scale": (1 + 0.18 * d, 1 - (1 - low) * d, 1 + 0.18 * d), "rot": (10 * d, 0, 0)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (60 * d, 0, 0)}
        for thigh, shin, foot, side in rig.get("legs", []):
            p[thigh] = {"rot": (-55 * d, 0, 0)}
            if shin:
                p[shin] = {"rot": (100 * d, 0, 0)}
            if foot:
                p[foot] = {"rot": (-45 * d, 0, 0)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (-50 * d, 0, -side * 25 * d)}
            if fore:
                p[fore] = {"rot": (-60 * d, 0, 0)}
        p = merge_pose(p, eyes(rig, 1 - 0.55 * d), tails(rig, swing_x=18 * d, t=t, wave=2), wings(rig, fold=80 * d))
        return {k: v for k, v in p.items() if k}
    return pose


def roll_clip(rig):
    def pose(t):
        d = ease(t / 0.5)
        p = {
            rig.get("body"): {"rot": (40 * d, 0, 0), "loc": (0, 0, -0.12 * d)},
            rig.get("head"): {"rot": (35 * d, 0, 0), "scale": (1 + 0.1 * d, 1 - 0.3 * d, 1 + 0.1 * d)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (80 * d, 0, 0)}
        for foot, side in rig.get("feet", []):
            p[foot] = {"loc": (-side * 0.04 * d, 0.08 * d, 0.14 * d), "rot": (-40 * d, 0, 0)}
        for thigh, shin, foot, side in rig.get("legs", []) + rig.get("quad_legs", []):
            p[thigh] = {"rot": (-80 * d, 0, 0)}
            if shin:
                p[shin] = {"rot": (130 * d, 0, 0)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (-70 * d, 0, -side * 10 * d)}
            if fore:
                p[fore] = {"rot": (-100 * d, 0, 0)}
        p = merge_pose(p, eyes(rig, 1 - 0.85 * d), tails(rig, swing_x=60 * d, t=t, wave=0), wings(rig, fold=90 * d))
        return {k: v for k, v in p.items() if k}
    return pose


def hover(rig):
    def pose(t):
        p = {
            rig.get("body"): {"rot": (-4, 0, 3 * s(t)), "loc": (0, 0, 0.02 * s(t * 2))},
            rig.get("head"): {"rot": (-6, 0, 0)},
        }
        if rig.has("spinner"):
            p[rig.get("spinner")] = {"rot": (0, -360 * t * 2, 0)}
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (-10 + 6 * s(t * 4), 0, 0)}
        for foot, side in rig.get("feet", []):
            p[foot] = {"loc": (0, 0.02 * s(t, 0.25 * side), -0.02), "rot": (20 + 10 * s(t, 0.25 * side), 0, 0)}
        for thigh, shin, foot, side in rig.get("legs", []) + rig.get("quad_legs", []):
            p[thigh] = {"rot": (12 + 8 * s(t, 0.25 * side), 0, 0)}
            if shin:
                p[shin] = {"rot": (20, 0, 0)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (0, 0, -side * (55 + 12 * s(t * 2)))}
        spun = rig.get("spinner_tails", False)
        p = merge_pose(p, tails(rig, swing_x=(85 if spun else 15), t=t * 2, wave=(4 if spun else 12)), wings(rig, flap=55 * s(t * 3), fold=-10))
        return {k: v for k, v in p.items() if k}
    return pose


def shoot(rig):
    def pose(t):
        k = bump(t, 0.0, 0.45)
        p = {
            rig.get("body"): {"rot": (-8 * k, 0, 0)},
            rig.get("head"): {"rot": (-6 * k, 0, 0), "scale": (1 + 0.1 * k, 1 - 0.07 * k, 1 + 0.1 * k)},
        }
        if rig.has("mouth"):
            p[rig.get("mouth")] = {"scale": (1 + 0.6 * k, 1 + 1.6 * k, 1)}
        if rig.has("jaw"):
            p[rig.get("jaw")] = {"rot": (25 * k, 0, 0)}
        for arm, fore, side in rig.get("arms", []):
            if side == rig.get("throw_side", -1):
                p[arm] = {"rot": (-80 * k - 20 * bump(t, 0.0, 0.2), 0, 0)}
                if fore:
                    p[fore] = {"rot": (-30 * (1 - k), 0, 0)}
        p = merge_pose(p, tails(rig, swing_x=10 * k, t=t, wave=3), wings(rig, flap=-20 * k, fold=20))
        return {k2: v for k2, v in p.items() if k2}
    return pose


def hit(rig):
    def pose(t):
        k = bump(t, 0.0, 0.7)
        wob = s(t * 3) * (1 - t)
        p = {
            rig.get("body"): {"rot": (-22 * k, 0, 10 * wob)},
            rig.get("head"): {"rot": (-14 * k, 8 * wob, 0), "scale": (1 + 0.12 * k, 1 - 0.16 * k, 1 + 0.12 * k)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (-30 * k, 0, 25 * wob)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (-40 * k, 0, -side * 60 * k)}
        p = merge_pose(p, eyes(rig, 1 - 0.85 * k), tails(rig, swing_x=30 * k, t=t * 3, wave=14 * (1 - t)), wings(rig, flap=40 * k, fold=0))
        return {k2: v for k2, v in p.items() if k2}
    return pose


def win(rig):
    def pose(t):
        jump = abs(s(t * 2)) * 0.5
        p = {
            rig.get("root"): {"loc": (0, 0, 0.28 * abs(s(t * 2))), "rot": (0, 360 * ease(t), 0)},
            rig.get("body"): {"rot": (-6, 0, 6 * s(t * 2))},
            rig.get("head"): {"scale": (1 - 0.05 * jump, 1 + 0.08 * jump, 1 - 0.05 * jump)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (-20 * abs(s(t * 2)), 0, 0)}
        for foot, side in rig.get("feet", []):
            p[foot] = {"loc": (0, 0, 0.05 * abs(s(t * 2))), "rot": (-15 * abs(s(t * 2)), 0, 0)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (0, 0, -side * (130 + 15 * s(t * 4)))}
            if fore:
                p[fore] = {"rot": (-10, 0, 0)}
        for thigh, shin, foot, side in rig.get("legs", []):
            p[thigh] = {"rot": (-25 * abs(s(t * 2)), 0, 0)}
            if shin:
                p[shin] = {"rot": (40 * abs(s(t * 2)), 0, 0)}
        if rig.has("mouth"):
            p[rig.get("mouth")] = {"scale": (1.3, 1.8, 1)}
        p = merge_pose(p, eyes(rig, 0.45), tails(rig, swing_x=10, t=t * 2, wave=16), wings(rig, flap=45 * s(t * 4), fold=0))
        return {k: v for k, v in p.items() if k}
    return pose


def lose(rig):
    def pose(t):
        d = ease(t / 0.7)
        p = {
            rig.get("body"): {"rot": (16 * d, 0, 0), "loc": (0, 0, -0.04 * d)},
            rig.get("head"): {"rot": (18 * d, 0, -5 * d), "scale": (1 + 0.05 * d, 1 - 0.1 * d, 1 + 0.05 * d)},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (45 * d, 0, 10 * d)}
        for arm, fore, side in rig.get("arms", []):
            p[arm] = {"rot": (8 * d, 0, -side * 2)}
        for thigh, shin, foot, side in rig.get("legs", []):
            p[thigh] = {"rot": (-20 * d, 0, 0)}
            if shin:
                p[shin] = {"rot": (35 * d, 0, 0)}
        if rig.has("mouth"):
            p[rig.get("mouth")] = {"scale": (0.8, 0.6, 1)}
        p = merge_pose(p, eyes(rig, 1 - 0.55 * d), tails(rig, swing_x=0, t=t, wave=2), wings(rig, fold=95 * d))
        return {k: v for k, v in p.items() if k}
    return pose


def select(rig):
    def pose(t):
        bounce = abs(s(t * 2))
        p = {
            rig.get("root"): {"loc": (0, 0, 0.06 * bounce)},
            rig.get("body"): {"rot": (-4, 0, 7 * s(t))},
            rig.get("head"): {"rot": (-6, 14 * s(t, 0.1), 9 * s(t, 0.25))},
        }
        if rig.has("crest"):
            p[rig.get("crest")] = {"rot": (-15 * bounce, 0, 10 * s(t))}
        for arm, fore, side in rig.get("arms", []):
            wave = side == rig.get("wave_side", 1)
            p[arm] = {"rot": ((-150 if wave else 5), 0, -side * (25 if wave else 8) + (18 * s(t * 4) if wave else 0))}
            if fore:
                p[fore] = {"rot": ((-25 + 15 * s(t * 4)) if wave else -10, 0, 0)}
        p = merge_pose(p, eyes(rig, 1 - bump(t, 0.8, 0.88)), tails(rig, t=t * 2, wave=12), wings(rig, flap=30 * s(t * 2), fold=10))
        return {k: v for k, v in p.items() if k}
    return pose


CLIPS = (
    ("Idle", idle, 48),
    ("Run", run, 14),
    ("Hop", hop, 14),
    ("Duck", duck, 8),
    ("Roll", roll_clip, 8),
    ("Hover", hover, 12),
    ("Shoot", shoot, 10),
    ("Hit", hit, 14),
    ("Win", win, 30),
    ("Lose", lose, 24),
    ("Select", select, 48),
)


def make_clips(arm_obj, rig):
    actions = []
    for name, maker, frames in CLIPS:
        actions.append(lib.action(arm_obj, name, frames, maker(rig), step=2))
    lib.push_actions_to_nla(arm_obj, actions)
    return actions
