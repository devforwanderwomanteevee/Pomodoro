# Working rules
- I am a complete beginner. Explain everything in simple, non-technical words. Avoid jargon, and if you must use a technical word, explain it in one sentence.
- Work on ONE step at a time. Never build features I haven't asked for in the current message.
- Before writing code for any step, tell me your plan in 5 to 7 simple bullets and wait for me to say "go".
- When a step is done, STOP. Tell me what you changed, exactly what I should see on screen to check it works, and wait for my next instruction.
- Do not add placeholder code for future features.
- Never push to main and never switch to main. Do not merge branches yourself. I merge pull requests myself on GitHub. If I ask you to do something on main, treat it as a single action, then return to your working branch and tell me which branch you are on. 
- Before every commit and push, state which branch you are on. If it is main, stop and ask me.

# Project
- A Pomodoro timer website. A painting from the Met Museum starts blurred and gets clearer as the timer runs. When the timer hits zero, the painting is fully sharp and the page shows the artist, the year, and a link to the Met Museum's page for that painting.
- The code is stored on GitHub.
- The site will be deployed on Vercel, so keep it simple and compatible with Vercel hosting.
- Never put secret keys in the code. If a key is ever needed, it goes in an environment variable.

# Requirements that always apply
- The user can set the timer length themselves on the page (minutes and seconds). The default is 25 minutes.
- Pause and Reset keep the same painting. Only Restart session loads a new painting.
- The painting details must never appear before the timer finishes.
- The timer must stay accurate when the browser tab is in the background.
