-- Ringside: four photos and five selling lines, in Jason's order and wording.
--
-- Jason, 5 October 2026. Loaded ahead of the header that shows them: the live
-- widget ignores photos, so nothing changes for a guest until the header with the
-- photo card is pasted into Tilda. The test page shows it now.
--
-- Photos: a seat in the 4th row of Section 5, the view from a Ringside seat, the
-- seating map, and the fact that every section has four rows.
-- The fifth line carries its second half as a note, in brackets under the line,
-- the same way LEO's guarantee line does.
--
-- Third line, flagged to Jason before this went in: it uses the word "assigned"
-- and says the place is reserved. Used as written until he says otherwise.

update ticket_classes set
  photos = '[
    {"url": "https://static.tildacdn.com/tild6337-6261-4839-a161-363333316461/1000035297.jpg",
     "alt": "View from the 4th row of Section 5"},
    {"url": "https://static.tildacdn.com/tild3435-3639-4434-b638-306366626537/1000035296.jpg",
     "alt": "Ringside seating view"},
    {"url": "https://static.tildacdn.com/tild3661-3665-4334-b135-346537336637/1000035299.jpg",
     "alt": "Ringside seating map"},
    {"url": "https://static.tildacdn.com/tild6165-3738-4566-b035-386433383138/1000035298.jpg",
     "alt": "Every section has 4 rows"}
  ]'::jsonb,
  benefits = '[
    {"text": "Ringside seats are the closest seats to the action"},
    {"text": "Ringside is where the action is: fighters, corners, referees and judges are all inside this section"},
    {"text": "Ringside seats are assigned, so your place is reserved"},
    {"text": "See, hear and feel every moment of the fight from your Ringside seat"},
    {"text": "Food and drink service to your Ringside seat all evening",
     "note": "(Food and drink not included in the ticket price)"}
  ]'::jsonb
where code = 'ringside';
