# The fifteen hardest questions, with honest answers

**1. You have no astronaut data. Why should we believe any of this applies in space?**
You should be careful, and we say so in the app. No open astronaut wearable time series exists: NASA's
in-flight actigraphy and cognition data are available on request only, and the open Inspiration4 data
is omics and blood panels. What we can show: the personal-baseline method works on real people on
Earth; the simulator reproduces published in-flight values such as 6.1 hours of sleep and the share of
nights under six hours; and on NASA's public bed-rest data, the closest open stand-in for a gravity
change, our transition handling cut false flags from 9 of 14 volunteers to 4 (p = 0.06, so suggestive only).
The next step is to request the in-flight data.

**2. Does it give early warning before symptoms?**
No, not on our evidence. On real data, at one false alert per person-month, 40% of illness episodes
had an alert start in the ten days up to symptom onset, and luck alone gives 28%. The alert typically
starts on or a day or two after onset. The original authors of the dataset reported 63%
pre-symptomatic detection using hourly data and a different algorithm; we did not reproduce that with
daily features.

**3. Then what is the value, if the person already feels ill?**
Three things. It turns "I feel off" into an objective record against the person's own normal and tells
the medical officer the same day. It covers slow changes nobody feels: sleep debt, missed exercise,
low fluid intake, a slide in mood. And it gives a specific, sourced action when nobody on Earth can be
asked.

**4. Two thirds flagged, but a third of that is luck. Is that impressive?**
It is modest, and we would rather show it than hide it. Keel flags 67% of real illness episodes;
luck gives 36%, so the honest figure is 31 points above luck (interval 21 to 41). A fixed threshold
is 15 above luck, so the personal baseline doubles the real signal, by 15 points (interval 2 to 30).
Real illness moves resting heart rate by about 3 to 5 beats per minute on average, three episodes in
ten show no rise at all, and heart rate varies by 3.5 from night to night. That is the physics of the
problem with two indicators.

**5. How do you know you did not overfit or leak?**
People, not days, are held out: five-fold cross-validation over people on real data, and separate
training and test missions in simulation. Baselines only look backwards, and that is unit-tested.
Thresholds come from training people only. The simulator is calibrated on one half of the real people
and checked against the other. The detector we deploy was chosen by a rule fixed in advance, on
simulated training missions. Three checks that it transfers: the measured false-alert rate on held-out
people is 1.00 against a budget of 1.00; training on one Stanford cohort and testing on the other
gives +29 and +38 points above luck; and five different fold splits give +31 to +33. We also had an
independent statistician-style review and fixed what it found; that log is in the repository.

**6. A simple rule does nearly as well as your detector. Why the complexity?**
We report that plainly: a two-of-three-days personal rule is 26 points above luck against 31 for the
multivariate detector, and the intervals overlap. Our selection rule prefers the simplest detector
unless a more complex one earns at least 3 points above luck on simulated training missions; the
multivariate one cleared that bar narrowly, once the simulator was given the real correlation between
heart rate and HRV. The part that clearly matters is the personal baseline itself.

**7. Most of your alerts are false. Is that not alarm fatigue by design?**
At in-flight illness rates about one alert-tier alert in eleven would be a real respiratory illness,
and one notice in forty. We state that in the app. That is why there are two tiers. A notice is
quiet, self-managed and shown as "worth a look". Only the alert tier, budgeted at one per four
person-months, or a symptom the person reports, can recommend involving the medical officer. On real
data an alert-tier flag was open on about 2% of healthy days and 56% of people never saw one. Whether
those budgets are right is a question for crews and flight surgeons; the point is that it is a dial
with a measured meaning, not a guess.

**8. Isn't the simulation just showing what you built into it?**
Partly, and the app says which parts. The day-to-day noise, the correlation between indicators and
the illness response in heart rate are fitted to real data on one half of the people. Effect sizes
for the other event types and for HRV, temperature, oxygen and mood are assumptions, marked in a
parameter table. Two checks tie it to reality, and neither flatters us: on the channels real data
has, simulated illness is harder to detect than real illness (+13 against +28 above luck), and
thresholds calibrated in simulation ran 40 to 70% over the false-alert budget on real people.

**9. Why not use an AI model to explain alerts or answer questions?**
Because the crew cannot check it and nobody on Earth can catch its mistakes. Advice comes from a table
of 28 rules that a flight surgeon can read in half an hour, each tied to a NASA document, a published
study or public clinical guidance, with an audit trail on every alert. A unit test fails the build if
rule text reads like a diagnosis.

**10. Has a doctor reviewed the advice?**
No practising clinician has. We ran a role-played flight-surgeon review with an AI reviewer, fixed
what it found (missing red flags, no fixed safety thresholds, exercise advice before fever was
excluded, a solar-storm alert that could not work), and we say plainly that this is not the same
thing. The fixed thresholds, such as 38.0 °C or 92% oxygen, are public guidance for adults on Earth.
Keel is decision support and a demonstration, not a medical device.

**11. If a crew member hides everything, isn't that dangerous for the mission?**
Three things are always visible. The commander sees a three-level flag for each person, never better
than that person's own worst reading, so nobody is assigned to a spacewalk blind. A red-flag symptom
or an "act now" reading is shown at once to the medical officer and to the commander as backup; the
crew agrees to that before flight and can switch it off. Cabin readings are never private. What stays
private is the reason behind an ordinary flag. Where to draw that line is a policy choice for an
agency; Keel makes it explicit and shows each person exactly what every role sees.

**12. How does it avoid flagging normal adaptation to weightlessness as illness?**
A phase change restarts the baseline, widens its band, and hands over to the person's own post-launch
data within two weeks. In simulation this halves false alerts in the first month of flight; on NASA
bed-rest data it cuts false flags after volunteers get up from 9 of 14 to 4. It has a cost we
measured: while the band is wide, real problems that begin in those first weeks are much harder to
see (19 against 34 points above luck). We have not tuned that trade-off yet.

**13. What happens with missing data or a broken sensor?**
The detector uses whatever indicators a person has. With the wearable unworn 40% of nights, simulated
detection falls from 67% to 63%; without any check-ins it falls to 46%. False alerts fall too. After
two days with no reading at all Keel shows "No recent data", not "Steady". Fixed safety rules work on
a single entered reading with no history at all.

**14. Is it really offline?**
There is no server. A service worker caches every file. An automated test loads the build, disables
the network, reloads, and uses every screen, including entering a check-in, changing sharing, cutting
the link, running the replay and importing a file. It fails on any console error or network request.

**15. What would you do with another six months?**
Get real spaceflight or analog data and repeat the evaluation. Move from daily to hourly features and
add overnight respiration and temperature, where the early illness signal is strongest in published
work. Put the rule table in front of flight surgeons. Test the interface with tired users. Add
tablet-to-tablet sync so the medical officer's view updates without a server.
