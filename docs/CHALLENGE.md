# Official challenge statement (verbatim)

- **Challenge:** Create Health Monitoring Software for Astronauts on Space Missions
- **Event:** 2026 NASA Space Apps Challenge
- **Source URL:** https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- **Retrieved:** 2026-11-12 (page metadata: first published 2026-09-17, last published 2026-10-29)
- **Difficulty:** Intermediate
- **Subjects:** Human Exploration, Software, Space Exploration
- **How it was retrieved:** the page is client-rendered, so the text below was extracted from the
  server payload embedded in the page HTML (`curl` + decoding the `self.__next_f` chunks). The wording
  is unchanged; only HTML tags were converted to Markdown.

---

## Summary

Long-duration missions expose astronauts to space radiation, isolation and confinement, altered
gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular
events, and behavioral health problems. On long missions, astronauts carry much of the responsibility
for spotting these changes in themselves. Your challenge is to build a health monitoring software that
gathers health indicators and enables astronauts to evaluate and act on the status of their health.

*(Embedded video: "2026 Challenge | Create Health Monitoring Software for Astronauts on Space
Missions", https://www.youtube.com/embed/RERG3gEmdC8 — not transcribed here.)*

## Background

With rising investment in spacecraft technology and research, space missions have become more
ambitious. NASA’s Artemis program recently accomplished a crewed lunar flyby, and NASA and others have
plans to send humans to Mars in the future. With increasingly longer missions, astronauts will be more
exposed to the hostile space environment, which brings both physical and mental health risks.

NASA’s Human Research Program has mapped the five hazards of human spaceflight, which are space
radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed
environments. These hazards can contribute to health problems such as immune system changes, bone
density loss, cardiovascular events, inadequate nutrition, behavioral health conditions, and others.
Astronauts must be capable of making health assessments on themselves during a mission, to prevent and
treat health problems that may arise. Some useful health indicators are blood pressure, heart rate,
blood sugar, body temperature, daily sleep hours, and mood.

## Objectives

Your challenge is to create a visual tool that helps astronauts assess their own health during space
missions and provides guidance on treatments and health improvements. You may consider gathering data
from the user through any kind of input—keyboard text, mouse clicks, or camera images, for example.
Any kind of data can be used, as long as it represents a health indicator, such as blood sugar levels
in mg/dL or ultrasound images.

You can use NASA’s Human Research Program resources, along with the publicly available resources from
other space agencies, to understand how spaceflight hazards affect human health, and to decide which
indicators are useful and how they can support a quick assessment. Which measurements can be performed
in space? Why is an exam needed? How do spaceflight hazards affect these health indicators? When might
a result warrant attention from the crew or from flight surgeons on the ground? What actions can be
taken to prevent a critical health condition? These are questions worth considering as you develop
your solution.

User interface design plays an important role in presenting metrics and diagnosis clearly. You may
consider taking advantage of animations and interactivity to present the information. For example, the
software could display a human figure where each part of the body is clickable and displays
information about its function and health status.

## Potential Considerations

*You may (but are not required to) consider the following:*

- Your tool could provide health insights for astronauts in different environments, such as a
  spacecraft, a space station, a rover, or a base on another planet or moon.
- Your tool could prompt astronauts to take measurements or complete specific actions from time to
  time as a part of the mission routine.
- Your tool could include the following features:
  - A gamification system to help astronauts engage with tasks that support their health
  - Dynamic charts that show how astronaut’s health indicators change over time
  - Color coding that helps the astronaut interpret the status of a health indicator at a glance
- Do not assume that astronauts know everything about how to assess their health. Your tool could
  provide simple instructions and explanations covering measurements, health indicators, and risks.

*For data and resources related to this challenge, refer to the Resources tab at the top of the page.
More resources may be added before the hackathon begins.*

## Resources tab (as of retrieval)

> *Resources will be available on Friday, November 13.*

No resources were listed on 2026-11-12. **Human step:** re-open the Resources tab on or after
2026-11-13 and add any listed resource to `docs/REQUIREMENTS.md` section C.
