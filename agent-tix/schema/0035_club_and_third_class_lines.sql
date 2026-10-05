-- Club Class and Third Class: the selling lines, in Jason's order and wording.
--
-- Jason, 5 October 2026. Lines only, no photos yet. A class with no photos is
-- drawn as it always was, so these stay invisible until the photos are added.
--
-- Flagged to Jason before they went in, and used as written until he decides:
--   Club Class, line 2: "Assigned seating" is a trade word and raises the
--     question "which seat?".
--   Third Class, line 1: "general admission" is a trade word, and reads as if
--     there were no seat, next to a line that says every ticket guarantees one.
--   Third Class, line 5: "Opens when the other classes are close to full" tells
--     every guest how full the other classes are, which the availability
--     function deliberately never does above four seats left.
-- The second half of a line is its note, shown in brackets underneath.

update ticket_classes set benefits = '[
  {"text": "Elevated seating with a crystal clear view of the ring"},
  {"text": "Assigned seating"},
  {"text": "Booked by around 55% of MuayTix guests"},
  {"text": "Suits first-time visitors, couples and families"},
  {"text": "Easy access to the food counter and restrooms"}
]'::jsonb where code = 'club_class';

update ticket_classes set benefits = '[
  {"text": "A great value general admission ticket that allows you to experience the stadium atmosphere and vibe"},
  {"text": "Choose where to sit on arrival, and every ticket guarantees a seat",
   "note": "(There are no standing areas inside the stadium)"},
  {"text": "More than twice the capacity of the rest of the stadium combined: when it fills, it''s one of the best atmospheres in the stadium"},
  {"text": "Section 11, the upper tier of the stadium"},
  {"text": "Opens when the other classes are close to full",
   "note": "(Generally open for all RWS events)"}
]'::jsonb where code = 'third_class';
