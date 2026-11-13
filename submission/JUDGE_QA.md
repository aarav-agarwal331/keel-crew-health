# The fifteen hardest questions, with honest answers

**1. You have no astronaut data. Why should we believe any of this applies in space?**
You should be careful, and we say so in the app. No open astronaut wearable time series exists: NASA's
in-flight actigraphy and cognition data are available on request only, and the open Inspiration4 data
is omics and blood panels. What we can show: the personal-baseline method flags real illness in people
on Earth above luck. What we cannot: that the simulator is a faithful stand-in. Its independent
realism checks fail or are off (for example nights under six hours are 50% against a published 44%).
On NASA's public bed-rest data, the closest open stand-in for a gravity change, a plain personal
baseline flagged 9 of 14 volunteers after getting up and Keel flagged 4, which is not significant
(p = 0.06), has no ground truth, and 4 of 14 is about what the same rule flags in quiet stretches by chance. The next step is to request the in-flight data.

**2. Does it give early warning before symptoms? If not, what is the value?**
No useful early warning shown. At the notice tier an alert started in the ten days up to symptom
onset for 46% of episodes against 28% by luck (+18, 9 to 28). At the stricter tier, the one that
brings in the medical officer, the gain is +1 (−5 to 7), that is, none. The notice-tier gain is small
and confounded (test dates, isolation after a positive test, lower activity on the day), so we do
not claim it. In our scripted replay Keel flags the illness on the day symptoms begin, from the
symptoms ticked at check-in combined with drifting readings; the sensors alone show it one day after.
The dataset's original authors reported pre-symptomatic detection with hourly data and a different
algorithm; we did not reproduce that with daily features. The value is elsewhere: it turns "I feel
off" into a record against the person's own normal and tells the medical officer the same day, it
covers slow changes nobody feels (sleep debt, missed exercise, low fluid intake), and it gives one
specific, sourced action when nobody on Earth can be asked.

**3. Why is your headline not the best number you have, and is it what the app does with a watch import?**
The best number (+34 above luck, 24 to 44) used daily steps and thresholds set on other real people;
Keel uses neither. Our headline is Keel's method on two sensors (overnight heart rate, 7-day activity)
with its model and thresholds fitted only on simulated people, applied unchanged to real people: 72%
of 107 episodes flagged against 40% by luck, +32 points (22 to 41), at 1.40 false alerts per
person-month against a budget of 1.00. At the stricter tier, the one that brings in the medical
officer, +19 (9 to 28) at 0.39 against 0.25. On the 132 people the simulator's fits did not use,
+35 (22 to 46). It is not what the shipped app would do with a watch import: the model file it ships
is calibrated for all eleven on-board channels, and given only a watch's channels it flagged 12% of
episodes (+9, 4 to 16) at 0.08 false alerts per person-month, with the stricter tier never firing.
Thresholds have to match the sensors, so imports now run on a separate heart-rate-only model
calibrated on the 251 real people, whose cross-validated result is +22 above luck (12 to 32).

**4. How do you know "above luck" is not just people staying home?**
We do not. Much of the signal is behavioural: people move less when ill (median daily steps fall
from 7,554 to 4,210), and that cannot be separated from isolating at home. "Above luck" is also an
upper bound: the pretend illness dates we use to measure luck cannot be matched to the calendar,
because dates are shifted for privacy, so travel, testing and isolation near a real onset are not
reproduced. Heart rate alone is +22 (12 to 32), and that is the safer figure.

**5. How do you know you did not overfit or leak?**
People, not days, are held out: five folds over people on real data, and separate training and test
missions in simulation. Baselines only look backwards, and that is unit-tested. The headline's
thresholds come from the simulator, and on the 132 real people the simulator's fits did not
use the result is +35 (22 to 46). Checks on the cross-validated result: training on one Stanford
cohort and testing on the other gives +33 and +33; five different fold splits give +34 to +36; the
original, wider window gives +31 (22 to 40). The cautions are ours: nothing was pre-registered,
analysis choices changed during four rounds of AI role-played review, and four detectors, two tiers
and several windows were compared without correction. That log is in the repository.

**6. Does your detector beat a simple rule?**
No, that is not shown. A simple personal rule (two of three days outside the personal range) is
28 points above luck on its own (19 to 38). Keel's detector leads it by +5 (−2 to 12), which is not
distinguishable. Against one fixed threshold for everyone the lead is +16 (3 to 29) in the detection
window used and +10 (−3 to 23) in the original wider window; with 7-day activity it is +24
(11 to 36) at the notice tier and +8 (−1 to 18) at the alert tier. So a personal baseline is probably
better than a fixed threshold, not proven, and the extra complexity of our detector has not earned
its place on real data.

**7. Most of your alerts are false. Is that not alarm fatigue by design?**
At in-flight illness rates between 1 in 11 and 1 in 27 alert-tier alerts would be a real respiratory
illness, and about 1 in 40 notices. We state that in the app. That is why there are two tiers. A
notice is quiet, self-managed and shown as "worth a look". Only the alert tier, or a symptom the
person reports, can recommend involving the medical officer. Both tiers ran over budget on real
people: 1.40 false alerts per person-month against 1.00, and 0.39 against 0.25. Whether those
budgets are right is a question for crews and flight surgeons; the point is that it is a dial with a
measured meaning, not a guess.

**8. Isn't the simulation just showing what you built into it?**
Largely, and the app says which parts. The simulator passes its realism checks only on quantities
fitted to the other half of the same data. The independent checks fail or are off: simulated illness
raises heart rate by 2.1 bpm against 4.6 in real episodes, HRV variability is 37% too high, and sleep
carry-over is off. Thresholds from simulation gave 1.38 and 0.40 false alerts per person-month on 72
real people (budgets 1.00 and 0.25), and 2.04 and 0.97 with five sensors on 16 people. Like for like
on two channels, simulated illness is flagged +11 above luck against +35 for real episodes. In
simulation overall Keel is +26 above luck (19 to 33), and for illness and low mood the interval
includes zero.

**9. Why not use an AI model to explain alerts or answer questions?**
Because the crew cannot check it and nobody on Earth can catch its mistakes. Advice comes from a table
of 43 rules that a flight surgeon can read in one sitting, each tied to a NASA document, a published
study or public clinical guidance, with an audit trail on every alert. A unit test fails the build if
rule text reads like a diagnosis. By design Keel gives no medication advice; its actions are first steps such as rest, fluids, a repeat reading or sugar for a low blood sugar.

**10. Has a doctor reviewed the advice?**
No clinician has reviewed anything. We ran four rounds of role-played review with an AI reviewer (a
flight surgeon, a statistician, an astronaut, a judge) and fixed what they found (missing red flags,
no fixed safety thresholds, mis-tiered extreme readings, exercise advice before fever was excluded, a
solar-storm alert that could not work), and we say plainly that this is not the same thing. The fixed
thresholds, such as 38.0 °C or 92% oxygen, are public guidance for adults on Earth.
Keel is decision support and a demonstration, not a medical device.

**11. If a crew member hides everything, isn't that dangerous for the mission?**
Some things are always visible. The commander sees a three-level flag for each person, never better
than that person's own worst reading, so nobody is assigned to a spacewalk blind. A red-flag symptom
or an "act now" reading is shown at once to the medical officer (an urgent reading also turns its
body area and the medical officer's view red) and stays on that list until the medical officer closes it with a note; most also
reach the commander as backup, but some (thoughts of self-harm, an injury, tooth pain, one-sided
swelling) go to the medical officer only. Under emergency sharing the medical officer sees the
symptom names and the readings with their times. Cabin readings are never private. What stays private
is the reason behind an ordinary flag. Where to draw that line is a policy choice for an agency; Keel
makes it explicit and shows each person exactly what every role sees.

**12. How does it avoid flagging normal adaptation to weightlessness as illness?**
A phase change restarts the baseline, widens its band, and hands over to the person's own post-launch
data as it arrives. In simulation this halves false alerts after launch: 0.90 per person-month in the
first 30 flight days against 1.98 without it. With luck taken from the same flight days, events that
begin in the first 25 flight days are +24 (14 to 33) above luck with phase handling and +15 (6 to 25)
without, so there is no measured cost. An earlier analysis that reported a cost was wrong: its luck
had been drawn from late flight. All of this is simulation only. On NASA bed-rest data the same
handling flagged 4 of 14 volunteers after getting up against 9, not significant, and the gain comes
from widening the band.

**13. What happens with missing data, a broken sensor or a mistyped reading?**
The detector uses whatever indicators a person has; in simulation detection falls when the wearable
is often unworn and falls further without check-ins. After two days with no reading at all Keel shows
"No recent data", not "Steady". Fixed safety rules work on a single entered reading with no history
at all. Every entered reading is kept with its time and the worst reading of the day counts, so a
repeat normal reading does not erase an abnormal one. Out-of-range readings are saved at once and can
be withdrawn as typing mistakes; a withdrawn reading is kept and shown struck through. Exercise is
held while any stop-or-rest advice is open.

**14. Is it really offline?**
There is no server. A service worker caches every file. Two automated end-to-end tests run the build
with the network disabled and use the screens, including entering a check-in, changing sharing,
cutting the link, running the replay and importing a file. They fail on any console error or network
request.

**15. What would you do with another six months?**
Get real spaceflight or analog data and repeat the evaluation. Set thresholds for every sensor subset a
crew member might have, not only the full set and heart rate alone. Move from daily to hourly features
and add overnight respiration and temperature, where the early illness signal is strongest in
published work. Put the rule table in front of flight surgeons. Test the interface with tired users.
Add tablet-to-tablet sync so the medical officer's view updates without a server.
