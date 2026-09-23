# Builds the week list for Block 2 straight from event_calendar + events.
#
# The cutoff is the real one: starts_at minus events.booking_cutoff_minutes.
# It is written onto each card as a UTC instant, so the page can drop a night
# the moment booking closes rather than at midnight. A card is never offered
# for a night whose booking has shut.
#
# Doors are not in the database. The day-dated pages carry them, and the
# offsets there are exact: RWS opens 70 minutes before the first bout, every
# other promoter 60. Those two numbers reproduce every published doors time,
# so they are used rather than a flat "about an hour".
import io, json, datetime as dt

DOORS_OFFSET = {"rws": 70}          # minutes before the first bout
DOORS_DEFAULT = 60

# Series slug -> the page a card links to. All Star is absent on purpose:
# no URL has been supplied for it, and a guessed one is a broken link.
PATH = {
    "new-power":           "/new-power-muay-thai",
    "petchyindee":         "/petchyindee-muay-thai",
    "rajadamnern-knockout":"/rajadamnern-knockout",
    "rws":                 "/rws",
    "kiatpetch":           "/kiatpetch-muay-thai",
}

# Display names, as the brief's own card copy writes them.
NAME = {
    "new-power":            "New Power Muay Thai",
    "petchyindee":          "Petchyindee Muay Thai",
    "rajadamnern-knockout": "Rajadamnern Knockout",
    "rws":                  "RWS Rajadamnern World Series",
    "kiatpetch":            "Kiatpetch Muay Thai",
}

rows = json.load(io.open("week.json", encoding="utf-8"))

def hhmm(label):
    t = dt.datetime.strptime(label, "%I:%M %p")
    return t

def fmt(t):
    return t.strftime("%I:%M %p").lstrip("0")

out = []
for r in rows:
    slug = r["series_slug"]
    if slug not in PATH:
        continue                       # All Star, until a URL arrives
    bell = hhmm(r["bell"])
    doors = bell - dt.timedelta(minutes=DOORS_OFFSET.get(slug, DOORS_DEFAULT))
    day = dt.date.fromisoformat(r["local_date"])
    href = "%s/%s" % (PATH[slug], r["local_date"])
    out.append(
'        <li class="mtx-hp__night" data-mtx-date="%s" data-mtx-cutoff="%s">\n'
'          <h3>%s</h3>\n'
'          <p class="mtx-hp__when">%s %s</p>\n'
'          <p class="mtx-hp__times">Doors %s &middot; First bout %s</p>\n'
'          <p class="mtx-hp__nightcta"><a class="mtx-hp__btn mtx-hp__btn--outline" href="%s">Book Tickets</a></p>\n'
'        </li>'
        % (r["local_date"], r["cutoff_utc"], NAME[slug],
           r["weekday"], r["day_label"].lstrip("0"), fmt(doors), fmt(bell), href))

io.open("week-cards.html", "w", encoding="utf-8").write("\n".join(out) + "\n")
print("%d cards, %s to %s" % (len(out), rows[0]["local_date"], rows[-1]["local_date"]))
