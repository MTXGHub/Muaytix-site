// Reads the stadium's availability tracker page (a Google Apps Script page that
// carries its whole data set inside it as `const DATA = {...}`) and gives back
// plain data. Pure code, no network and no database, so it can be tested on a
// saved copy of the page. See agent-tix/notes/stadium-availability-tracker.md.

export type TrackerDay = { d: string; o: number; z: string };
export type Tracker = {
  generated: string;
  today: string;
  zones: string[];
  events: TrackerDay[];
  log: { at: string; t: string; d: string; s: string; z: string[] }[];
};

// The order of zones is part of the contract: each day's `z` is one letter per
// zone in this order. If the stadium changes it, we must stop, not guess.
export const EXPECTED_ZONES = [
  "PANORAMIC", "COUPLE", "PRESIDENTIAL", "RINGSIDE", "CLUB", "LEO", "THIRD",
];

// Undo one layer of JavaScript string escaping (\xNN, \uNNNN, \\, \n ...).
function unescapeJsString(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") { out += c; continue; }
    const n = s[++i];
    if (n === "x") { out += String.fromCharCode(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else if (n === "u") { out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16)); i += 4; }
    else if (n === "n") out += "\n";
    else if (n === "r") out += "\r";
    else if (n === "t") out += "\t";
    else out += n; // \\ \' \" \/ and anything else stand for themselves
  }
  return out;
}

// The page's own HTML sits inside the response as a string of a string.
export function extractUserHtml(response: string): string {
  const m = response.match(/userHtml\\x22:\\x22([\s\S]*?)\\x22,\\x22/);
  if (!m) throw new Error("tracker page has no userHtml block");
  let t = unescapeJsString(m[1]);
  t = t.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
  return t;
}

// Take the balanced {...} that starts at `from`, aware of strings.
function balancedObject(text: string, from: number): string {
  let depth = 0, inStr = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return text.slice(from, i + 1); }
  }
  throw new Error("tracker DATA object is not closed");
}

export function parseTracker(response: string): Tracker {
  const html = extractUserHtml(response);
  const at = html.indexOf("const DATA = ");
  if (at < 0) throw new Error("tracker page has no DATA");
  const start = html.indexOf("{", at);
  const data = JSON.parse(balancedObject(html, start));

  const zones: string[] = (data.zones ?? []).map((z: { c: string }) => z.c);
  if (zones.join(",") !== EXPECTED_ZONES.join(",")) {
    throw new Error("tracker zones changed: " + zones.join(","));
  }
  const events: TrackerDay[] = data.events ?? [];
  if (events.length < 300) throw new Error("tracker has too few days: " + events.length);
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.d) || typeof e.z !== "string" || e.z.length !== zones.length) {
      throw new Error("tracker day looks wrong: " + JSON.stringify(e));
    }
  }
  return {
    generated: String(data.generated ?? ""),
    today: String(data.today ?? ""),
    zones,
    events,
    log: data.log ?? [],
  };
}

export type Change = {
  night: string;
  zone: string; // a zone code, or "DAY"
  from: string; // A / F / N, or "open" / "closed" for DAY
  to: string;
};

// What changed between two reads. A day we had not seen before is not a change
// of status (it is reported as zone "NEW" so it is logged and nothing else).
export function diffTrackers(prev: Map<string, { z: string; o: number }>, now: Tracker): Change[] {
  const out: Change[] = [];
  for (const e of now.events) {
    const was = prev.get(e.d);
    if (!was) { out.push({ night: e.d, zone: "NEW", from: "-", to: e.z }); continue; }
    if (was.o !== e.o) {
      out.push({ night: e.d, zone: "DAY", from: was.o ? "open" : "closed", to: e.o ? "open" : "closed" });
    }
    for (let k = 0; k < now.zones.length; k++) {
      if (was.z[k] !== e.z[k]) {
        out.push({ night: e.d, zone: now.zones[k], from: was.z[k], to: e.z[k] });
      }
    }
  }
  return out;
}
