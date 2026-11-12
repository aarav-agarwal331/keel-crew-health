# Spoken pitches

## 60 seconds

On the International Space Station a flight surgeon is seconds away by voice. On the way to Mars
that stops working. A signal takes up to about twenty-four minutes each way, and for days or weeks
there may be no link at all. NASA's own planning says medical decisions have to move on board.

Keel is a crew health monitor that needs no connection to Earth. It runs entirely on the crew member's
tablet. It learns that person's own normal, notices when their readings drift, says what changed in
plain words, and gives one action from a fixed table of rules with cited sources. Red-flag symptoms
and dangerous readings are acted on at once. No diagnosis, no medication advice, no chatbot. The crew
member owns the data and decides what the medical officer, the commander and the ground can see.

Watch: I cut the link. Everything still works.

And we measured it. On 107 real illness episodes from 251 people, Keel's method, on two sensors,
with thresholds set only in simulation, flags 72 percent. Luck alone gives 40, and we say so: it is
32 points above luck, at 1.4 false alerts per person-month, over its budget of one. We also show
what it cannot do: no useful early warning shown, and most alerts are false. That is in the app,
next to the result.

Keel: a health monitor that keeps working when Earth cannot answer.

## 3 minutes

**The gap (30 s).** Today, astronaut health care leans on Earth. On the ISS a flight surgeon is
seconds away by voice and talks privately with each crew member about once a week; routine vital
signs are not streamed to the ground. If someone needs urgent care, they can be home in hours. None
of that survives the trip to Mars. One-way
signal delay runs from about four to about twenty-four minutes. Around solar conjunction, NASA stops
commanding its Mars spacecraft for two weeks. NASA calls the answer Earth-independent medical
operations: the crew has to detect and act on health changes themselves. The challenge statement says
the same in one line: astronauts carry much of the responsibility for spotting these changes in
themselves.

**What Keel is (40 s).** Keel is a health monitor built for that situation. It is an offline-first app
on the crew member's own tablet, with no server. It tracks 18 indicators chosen from NASA's
five hazards, among them heart rate, heart rate variability, oxygen, temperature, sleep and its
timing, exercise, reaction time, mood, fluids, food, blood pressure, blood sugar, body mass, and the
cabin's carbon dioxide and radiation. It learns each person's own baseline, because a resting heart
rate of 62 is normal for one person and a warning for another. It knows that launch changes the body
on purpose. And some things never wait for a trend: chest pain, or an oxygen reading of 92, goes
straight to "tell the medical officer now", and stays on the medical officer's list until closed
with a note.

**Demo (50 s).** Here is a day with the link up, a few minutes each way. I cut it. Now I play a
scripted illness from our simulated mission, during a two-week blackout. Her heart rate rises,
variability falls, and on the day symptoms begin, when she ticks them at check-in, Keel says: "Act
today. Take your temperature now. No exercise until you have. Tell the medical officer." The sensors
alone show the illness pattern one day later. She types the reading in right there, and Keel picks
the next step. Tap why: the evidence against her own range, what else in her data
might explain it, how soon and who, and the source behind the advice. There is an audit trail: this
rule, these scores. Nothing here was written by a language model. Now the commander's view: Lucía is
"talk to the medical officer first", reason not shared. She owns that.

**Does it work (40 s).** We tested it on two public Stanford datasets: 251 people with overnight
heart rate, activity and 107 dated illness episodes. We ran Keel's method on those two sensors, with
its model and thresholds fitted only on simulated people, unchanged. It flags 72 percent of episodes. Luck alone gives 40, so
the honest number is 32 points above luck, with an interval of 22 to 41. It costs 1.4 false alerts
per person-month against a budget of one. The stricter tier, the one that brings in the medical
officer, is 19 points above luck. A personal baseline is probably better than one threshold for
everyone, not proven, and our detector is not shown to beat a simple personal rule. On NASA's public
bed-rest data, handling gravity changes flagged four volunteers in fourteen instead of nine, which
is not statistically significant.

**Honesty and next steps (20 s).** What we cannot claim: useful early warning. At the tier that
brings in the medical officer, alerts start before symptoms no more often than luck. Most alerts are
false: at the alert tier between one in eleven and one in twenty-seven would be a real illness. The
model file the app ships is tuned for eleven on-board channels; on a watch import, with overnight
heart rate and sometimes sleep, it was only 9 points above luck, because thresholds have to match the sensors. So imports now run
on a heart-rate-only model calibrated on the 251 real people, 22 points above luck. Much of the signal is people moving less when ill. Everything
beyond illness is tested only in simulation, no clinician has reviewed anything, and no open
astronaut wearable data exists. The next step is to ask NASA for the in-flight data that is available
on request and repeat the test. Keel: it keeps working when Earth cannot answer.
