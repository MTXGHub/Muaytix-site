#!/bin/sh
# The swap has to be invisible from outside while it runs: another guest reading
# the class during the swap must see the OLD state (the old seats still held),
# never a moment where they are free, and must be able to take nothing until the
# swap has committed. Needs a scratch database made from replica.sql, as in
# guest_hold.test.sql. Two separate connections are the only way to see this.
#
#   PGHOST=/tmp PGPORT=5544 PGUSER=postgres sh guest_hold_concurrency.test.sh holdtest
DB=${1:-holdtest}
P="psql -q -t -A -X -v ON_ERROR_STOP=1 $DB"
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1  -> got '$2', wanted '$3'"; fi; }

CLUB=00000000-0000-0000-0000-00000000f101
$P -c "update event_ticket_classes set total_quantity=10, sold_quantity=6, reserved_quantity=0 where id='$CLUB'; update checkout_reservations set status='failed' where event_ticket_class_id='$CLUB' and status='held';"
OLD=$($P -c "select reservation_id from replace_reservation(null,'$CLUB',3,now()+interval '5 minutes');" | head -1)
# 4 left: guest A holds 3, public sees 1.

# Session A: change 3 -> 2, then sit inside the transaction for 3 seconds before committing.
$P -c "begin; select 1 from replace_reservation('$OLD','$CLUB',2,now()+interval '5 minutes'); select pg_sleep(3); commit;" >/dev/null &
sleep 1

# Session B, one second in, during the swap:
SEEN=$($P -c "select quantity_available from event_ticket_classes where id='$CLUB';")
ck "during the swap, another guest still sees the old state (1 left, never 3 or 2)" "$SEEN" "1"
HOLD_STATE=$($P -c "select status from checkout_reservations where id='$OLD';")
ck "during the swap, the old hold still reads as held to everyone else" "$HOLD_STATE" "held"

# Session B tries to take the last seat while the swap is open. It must wait for the swap, then see 2 left.
START=$(date +%s)
GOT=$($P -c "select (select available_after from reserve_tickets('$CLUB',1,now()+interval '5 minutes'));")
END=$(date +%s)
wait
ck "another guest's reserve waited for the swap to finish (blocked about 2 seconds)" "$( [ $((END-START)) -ge 1 ] && echo waited || echo did-not-wait )" "waited"
ck "and then saw the NEW count: 2 left after the swap, 1 left after taking one" "$GOT" "1"
ck "the old hold ended released, not held" "$($P -c "select status from checkout_reservations where id='$OLD';")" "released"
ck "seats reserved: 2 (new hold) + 1 (the other guest)" "$($P -c "select reserved_quantity from event_ticket_classes where id='$CLUB';")" "3"

# A failing swap in an open transaction must not release anything, even for a moment.
$P -c "update event_ticket_classes set total_quantity=10, sold_quantity=6, reserved_quantity=0 where id='$CLUB'; update checkout_reservations set status='failed' where event_ticket_class_id='$CLUB' and status='held';"
OLD=$($P -c "select reservation_id from replace_reservation(null,'$CLUB',3,now()+interval '5 minutes');" | head -1)
$P -c "begin; select 1 from replace_reservation('$OLD','$CLUB',2,now()+interval '5 minutes') where false; savepoint s; select pg_sleep(0); rollback;" >/dev/null
OUT=$($P -c "begin; do \$\$ begin perform replace_reservation('$OLD','$CLUB',9,now()+interval '5 minutes'); exception when others then null; end \$\$; select quantity_available from event_ticket_classes where id='$CLUB'; commit;" | tail -1)
ck "a refused swap leaves the public count exactly as it was (1 left)" "$OUT" "1"
ck "and the old hold is still held" "$($P -c "select status from checkout_reservations where id='$OLD';")" "held"

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
