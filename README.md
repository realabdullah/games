# Games

A small collection of party games for friends, families and teams.

One person opens the game on a big screen (a TV, or a shared screen on a video call). Everyone else joins on their phone with a four-letter room code. No accounts, no app to install.

## The games

- **Trivia Rush**: quick multiple-choice questions, with points for speed. You can write your own question packs.
- **Who Said It?**: everyone answers a question about themselves, then the group guesses who wrote what.
- **Quick Wit**: two players answer the same funny prompt, and the room votes for the best one.
- **Doodle Dash**: one player draws a word on their phone while everyone else races to guess it.
- **X-O Battle**: tic-tac-toe where the winner stays on, or play alone against the computer.

Most games also work with everyone on their own screen, and some can be played solo.

## Run it locally

You need [Bun](https://bun.sh).

```bash
bun install
```

```bash
bun run dev
```

Then open http://localhost:5173.

## Built with

SvelteKit for the web app and Bun for the game server, with SQLite for storage.
