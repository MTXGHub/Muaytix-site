# Builds a day-dated page per night from the Rajadamnern Knockout page.
#
# Everything that changes per event comes from event_calendar: the name, the
# date, the first bell, the finish and the description. The one thing that does
# not is the doors time, which is taken as an hour before the bell -- the
# convention the site's own FAQ already states. It is called out in the report.
import io, re, os

BASE = "/home/user/Muaytix-site/pages/knockout/rajadamnern-knockout-2026-09-22.html"
OUT  = "/home/user/Muaytix-site/pages/nights"

NIGHTS = [
 dict(key="rajadamnern_knockout_2026_09_25", name="Rajadamnern Knockout", short="Knockout",
      iso="2026-09-25", long="Friday 25 September 2026", tiny="Fri 25 Sep 2026",
      bell="19:00", bell12="7:00 PM", doors12="6:00 PM", finish12="9:00 PM",
      series="/rajadamnern-knockout",
      blurb="Fast-paced three-round fights, chasing a knockout from the opening bell.",
      h2="Bangkok's fastest-paced Muay Thai event",
      p1="Tonight at Rajadamnern Stadium, three-round bouts deliver a faster, more immediate Muay Thai experience, with less tactical waiting and action designed to build from the opening bell through to the final fight.",
      p2="The shorter format and earlier finish make it a straightforward first taste of live Muay Thai, and a good fit if your evening in Bangkok is already busy.",
      fmt="Three-round bouts", fmtsub="Faster pace and an earlier finish",
      pace="Three-round contests continue through the evening."),
 dict(key="kiatpetch_2026_09_27", name="Kiatpetch Traditional Muay Thai", short="Kiatpetch",
      iso="2026-09-27", long="Sunday 27 September 2026", tiny="Sun 27 Sep 2026",
      bell="18:00", bell12="6:00 PM", doors12="5:00 PM", finish12="10:00 PM",
      series="/kiatpetch-muay-thai",
      blurb="Technical fighters blend fast-paced three-round bouts with classic five-round Muay Thai before a lively Sunday-night local crowd.",
      h2="Three-round and five-round Muay Thai in one night",
      p1="Tonight at Rajadamnern Stadium, Kiatpetch blends fast-paced three-round bouts with classic five-round Muay Thai, so the evening changes gear as it goes.",
      p2="It is the widest range of Muay Thai on offer in a single night, in front of a lively Sunday-night local crowd.",
      fmt="Three and five-round bouts", fmtsub="Both formats on one card",
      pace="Three-round and five-round contests continue through the evening."),
]

base = io.open(BASE, encoding="utf-8").read()

# The fight card is released by the stadium on the day. None of these nights
# has one yet, so the section comes out rather than shipping empty.
m = re.search(r'\n  <!-- FIGHT CARD.*?\n  </section>\n', base, re.S)
assert m, "fight card section not found"
base = base.replace(m.group(0), "\n", 1)
# The fight-card STYLES stay in the stylesheet: they cost nothing unused and
# mean a card can be dropped in later as markup alone. Only the markup goes.
assert 'class="mtx-kp__bout"' not in base.split("</style>",1)[1], "fight card markup left behind"

def section(tag, text):
    m = re.search(r'\n  <!-- %s -->\n  <section.*?\n  </section>\n' % tag, text, re.S)
    assert m, tag
    return m.group(0)

HERO   = section("HERO", base)
BAND   = section("WHAT THIS EVENING IS", base)
SCHED  = section("SCHEDULE", base)
BOOK   = section("BOOKING", base)

PREFIX = "Tonight at Rajadamnern Stadium, "

for n in NIGHTS:
    assert n["p1"].startswith(PREFIX), n["key"]
    n["p1_default"] = "On %s at Rajadamnern Stadium, %s" % (n["long"], n["p1"][len(PREFIX):])

    s = base

    # --- wrapper: the date and times the page reads itself ---
    s = s.replace('data-night="2026-09-22"', 'data-night="%s"' % n["iso"], 1)
    s = s.replace('data-doors="18:00"', 'data-doors="%s"' % ("17:00" if n["bell"]=="18:00" else "18:00"), 1)
    s = s.replace('data-bell="19:00"', 'data-bell="%s"' % n["bell"], 1)
    s = s.replace('data-next="/rajadamnern-knockout"', 'data-next="%s"' % n["series"], 1)

    hero = '''
  <!-- HERO -->
  <section class="mtx-kp__hero">
    <div class="mtx-kp__shell">

      <div class="mtx-kp__over">
        <strong>This fight night has finished</strong>
        <span>The next {short} night at Rajadamnern Stadium is on sale now.</span>
        <a class="mtx-kp__btn mtx-kp__btn--blue" href="{series}">See the next {short} night</a>
      </div>

      <span class="mtx-kp__eyebrow"><span class="mtx-kp-when-tonight">Tonight in Bangkok &middot; </span>{long} &middot; Rajadamnern Stadium, Bangkok</span>
      <h1>{name}</h1>

      <p class="mtx-kp__countdown"><span class="mtx-kp__dot"></span><span data-mtx-countdown aria-live="polite">First bell at {bell12}</span></p>

      <p class="mtx-kp__lede"><span class="mtx-kp-v-tonight">Tonight at Rajadamnern Stadium. {blurb} The first fight begins at {bell12}.</span><span class="mtx-kp-v-default">On {long}, {name} returns to Rajadamnern Stadium. {blurb} The first fight begins at {bell12}.</span></p>
      <div class="mtx-kp__actions">
        <a class="mtx-kp__btn mtx-kp__btn--blue" href="#choose-seats"><span class="mtx-kp-v-tonight">Book seats for tonight</span><span class="mtx-kp-v-default">Book {short} tickets</span></a>
        <a class="mtx-kp__btn mtx-kp__btn--ghost" href="#schedule">See the evening schedule</a>
      </div>

      <ul class="mtx-kp__facts">
        <li><strong><span class="mtx-kp-v-tonight">Tonight in Bangkok</span><span class="mtx-kp-v-default">{long}</span></strong><span><span class="mtx-kp-v-tonight">{long}</span><span class="mtx-kp-v-default">{h2}</span></span></li>
        <li><strong>First fight {bell12}</strong><span>Finishes around {finish12}</span></li>
        <li><strong>{fmt}</strong><span>{fmtsub}</span></li>
        <li><strong>Rajadamnern Stadium</strong><span>The world's first purpose-built Muay Thai stadium</span></li>
      </ul>
    </div>
  </section>
'''.format(**n)

    band = '''
  <!-- WHAT THIS EVENING IS -->
  <section class="mtx-kp__band">
    <div class="mtx-kp__shell">
      <span class="mtx-kp__kicker">The event</span>
      <h2>{h2}</h2>
      <p><span class="mtx-kp-v-tonight">{p1}</span><span class="mtx-kp-v-default">{p1_default}</span></p>
      <p>{p2}</p>
    </div>
  </section>
'''.format(**n)

    sched = '''
  <!-- SCHEDULE -->
  <section class="mtx-kp__band" id="schedule">
    <div class="mtx-kp__shell">
      <span class="mtx-kp__kicker"><span class="mtx-kp-v-tonight">Tonight &middot; </span>{tiny}</span>
      <h2>How the evening runs</h2>
    <ol class="mtx-kp__timeline">
      <li>
        <span class="mtx-kp__time">{doors12}</span>
        <div><strong>Doors open</strong><em>Gates open at Rajadamnern Stadium.</em></div>
      </li>
      <li>
        <span class="mtx-kp__time">{bell12}</span>
        <div><strong>First fight</strong><em>The opening bout begins.</em></div>
      </li>
      <li>
        <span class="mtx-kp__time">Through the evening</span>
        <div><strong>{fmt}</strong><em>{pace}</em></div>
      </li>
      <li>
        <span class="mtx-kp__time">Around {finish12}</span>
        <div><strong>Expected finish</strong><em>Final bout and close.</em></div>
      </li>
    </ol>
      <p class="mtx-kp__note">Timings may be subject to minor change on the night. You may enter at any time after the event has started, as the gates remain open throughout the evening, so late arrival is fine.</p>
    </div>
  </section>
'''.format(**n)

    book = '''
  <!-- BOOKING -->
  <section class="mtx-kp__booking" id="book-tickets">
    <div class="mtx-kp__shell">
      <span class="mtx-kp__kicker">Book tickets</span>
      <h2>{name} at Rajadamnern Stadium</h2>
      <p class="mtx-kp__lede"><span class="mtx-kp-v-tonight">Choose your seats for tonight.</span><span class="mtx-kp-v-default">Choose your seats for this {short} event.</span></p>
      <div class="mtx-kp__panel">
        <div class="mtx-kp__fixed">
          <div>
            <span class="mtx-kp__fixed-label"><span class="mtx-kp-v-tonight">Tonight in Bangkok</span><span class="mtx-kp-v-default">Your fight night</span></span>
            <strong>{long}</strong>
            <em>First fight {bell12} &middot; Rajadamnern Stadium, Bangkok</em>
          </div>
        </div>

        <span class="mtx-kp__jump" id="choose-seats" aria-hidden="true"></span>

        <div class="muaytix-ticket-selector" data-event-id="{key}"></div>

      </div>
    </div>
  </section>
'''.format(**n)

    s = s.replace(HERO, hero, 1)
    s = s.replace(BAND, band, 1)
    s = s.replace(SCHED, sched, 1)
    s = s.replace(BOOK, book, 1)

    # Seating intro mentions the Knockout bout count.
    s = s.replace("Every seat class watches the same seven bouts.",
                  "Every seat class watches the same fights.", 1)

    # "Official" is retired across the business.
    s = s.replace("MuayTix is an official ticketing partner for Rajadamnern Stadium",
                  "MuayTix is the international ticket partner of Rajadamnern Stadium", 1)

    # The trust strip's button names the promoter. It lives outside the
    # sections replaced above, so the base page's name would otherwise stay
    # and offer Kiatpetch visitors "Book Rajadamnern Knockout tickets".
    assert s.count("Book Rajadamnern Knockout tickets") == 1, n["key"]
    s = s.replace("Book Rajadamnern Knockout tickets", "Book %s tickets" % n["short"], 1)

    # A stray example date in a script comment.
    s = s.replace("// 2026-09-22", "// %s" % n["iso"], 1)

    # The reuse note at the top of the file.
    s = re.sub(r'^<!--.*?-->\n', '', s, count=1, flags=re.S)
    s = ('<!--\n  %s - %s\n  Paste this whole thing into one HTML block (Tilda T123).\n'
         '  Suggested page address: %s/%s\n-->\n' % (n["name"], n["long"], n["series"], n["iso"])) + s

    # --- checks ---
    body_only = s.split("</style>",1)[1]
    assert 'class="mtx-kp__bout"' not in body_only, "%s: fight card markup" % n["key"]
    for bad in ["2026-09-22", "Tuesday 22 September", "Tue 22 Sep",
                "rajadamnern_knockout_2026_09_22", "seven three-round",
                "official ticketing partner"]:
        assert bad not in s, "%s: leftover %r" % (n["key"], bad)
    assert s.count(n["key"]) == 1, n["key"]
    assert "#mtx-booking h1" in s, "widget heading guard lost"
    assert s.count("<h1") == 1

    # Every "tonight" in the body must sit inside a tonight/default swap, or
    # a page about Friday tells a Wednesday reader the fight is tonight. That
    # is what this check exists to stop happening again.
    import html as _html
    visible = re.sub(r"<script.*?</script>", "", body_only, flags=re.S)
    visible = re.sub(r'<span class="mtx-kp-v-tonight">.*?</span>', "", visible, flags=re.S)
    visible = re.sub(r'<span class="mtx-kp-when-tonight">.*?</span>', "", visible, flags=re.S)
    visible = re.sub(r"<[^>]+>", " ", visible)
    stray = [w for w in re.findall(r"[^.!?]*\btonight\b[^.!?]*", visible, re.I)]
    assert not stray, "%s: unguarded 'tonight': %r" % (n["key"], stray[:2])

    io.open(os.path.join(OUT, n["key"] + ".html"), "w", encoding="utf-8").write(s)

    # The paste-ready copy, generated here so it cannot drift from the source.
    live = re.sub(r"<style>(.*?)</style>",
                  lambda m: "<style>" + re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S) + "</style>",
                  s, flags=re.S)
    live = re.sub(r"<script>(.*?)</script>",
                  lambda m: "<script>" + re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S) + "</script>",
                  live, flags=re.S)
    live = re.sub(r"<!--.*?-->", "", live, flags=re.S)
    live = re.sub(r"\n{3,}", "\n\n", live).strip() + "\n"
    io.open(os.path.join(OUT, n["key"] + "-live.txt"), "w", encoding="utf-8").write(live)
    print("%-34s %6d bytes   bell %s  doors %s  finish %s" %
          (n["key"], len(s), n["bell12"], n["doors12"], n["finish12"]))
