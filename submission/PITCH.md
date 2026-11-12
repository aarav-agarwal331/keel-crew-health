# Spoken pitches

## 60 seconds

On the International Space Station a flight surgeon is seconds away by voice. On the way to Mars
that stops working. A signal takes up to about twenty-four minutes each way, and for days or weeks
there may be no link at all. NASA's own planning says medical decisions have to move on board.

Keel is a crew health monitor that needs no connection to Earth. It runs entirely on the crew member's
tablet. It learns that person's own normal, notices when their readings drift, says what changed in
plain words, and gives one action tied to a documented countermeasure. Red-flag symptoms and
dangerous readings are acted on at once. No diagnosis, no chatbot. The crew member owns the data and
decides what the medical officer, the commander and the ground can see.

Watch: I cut the link. Everything still works.

And we measured it. On real wearable data from 251 people, at one false alert a month, Keel flags
two thirds of illness episodes. A third of that is luck, and we say so: Keel is 31 points above luck,
a fixed threshold only 15. We also show what it cannot do: it catches illness around the day symptoms
start, not before, and most of its alerts are false. That is in the app, next to the result.

Keel: a health monitor that keeps working when Earth cannot answer.

## 3 minutes

**The gap (30 s).** Today, astronaut health care leans on Earth. Flight surgeons sit in Mission
Control, follow exercise and cabin air, and speak privately with each crew member every week. If
someone needs urgent care, they can be home in hours. None of that survives the trip to Mars. One-way
signal delay runs from about four to about twenty-four minutes. Around solar conjunction, NASA stops
commanding its Mars spacecraft for two weeks. NASA calls the answer Earth-independent medical
operations: the crew has to detect and act on health changes themselves. The challenge statement says
the same in one line: astronauts carry much of the responsibility for spotting these changes in
themselves.

**What Keel is (40 s).** Keel is a health monitor built for that situation. It is an offline-first app
on the crew member's own tablet, with no server. It tracks seventeen indicators chosen from NASA's
five hazards: heart rate, heart rate variability, oxygen, temperature, sleep and its timing, exercise,
reaction time, mood, fluids, food, blood pressure, blood sugar, body mass, and the cabin's carbon
dioxide and radiation. It learns each person's own baseline, because a resting heart rate of 62 is
normal for one person and a warning for another. It knows that launch changes the body on purpose.
And some things never wait for a trend: chest pain, or an oxygen reading of 92, goes straight to
"tell the medical officer now".

**Demo (50 s).** Here is a day with the link up, a few minutes each way. I cut it. Now I play a
scripted illness from our simulated mission. Her heart rate rises, variability falls, and on the day
she reports a sore throat Keel says: "Act today. Take your temperature and hold exercise until you
have. Tell the medical officer." Tap why: the evidence against her own range, what else in her data
might explain it, how soon and who, and the source behind the advice. There is an audit trail: this
rule, these scores. Nothing here was written by a language model. Now the commander's view: Lucía is
"talk to the medical officer first", reason not shared. She owns that.

**Does it work (40 s).** We tested it on two public Stanford datasets: 251 people with heart rate,
steps and dated illness. Thresholds are set to a false-alert budget, because alarm fatigue is a
hazard. At one false alert per person-month Keel flags 67 percent of illness episodes. Luck alone
gives 36, so the honest number is 31 points above luck. A single threshold for everyone manages 15.
Held-out people, confidence intervals, and the measured false-alert rate matches the budget. On
NASA's own bed-rest data, our handling of gravity changes cut false flags from nine volunteers in
fourteen to four.

**Honesty and next steps (20 s).** What we cannot claim: early warning. The alert comes around the
day symptoms start. Most alerts are false, about ten in eleven at the strict tier. Everything beyond
illness is tested only in simulation, and no open astronaut wearable data exists. The next step is to
ask NASA for the in-flight data that is available on request and repeat the test. Keel: it keeps
working when Earth cannot answer.
