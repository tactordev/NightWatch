## NightWatch
A discord bot that allows you to have seamless management for your roleplay server. It has the basic barebones and will have fully-fledged custom integrations. 

<img width="485" height="850" alt="bilde" src="https://github.com/user-attachments/assets/45cc181f-55a3-46ff-80c5-0da49d2d4c05" />


### Demo: https://www.youtube.com/watch?v=9GHtquILcJk

***
### Local Installation
To install the bot and run it locally (to either host it locally or to test it out), follows the steps below.
1. Download the code by clicking on: `Code > Download ZIP` to the top right of the code. **OR** Use `git clone https://github.com/tactordev/nightwatch` in your terminal. **OR** Download the source code from the `Releases` tab.
2. Then enter the folder (`cd nightwatch`).
3. Ensure you have NodeJS installed (https://nodejs.org/).
4. Run `npm install`.
5. Ensure you fill in your `TOKEN` and `clientId` in the `config.json`. All other fields will be populated on the first run of `index.js` or when you run the `/utility setup` command.
6. Run `node index.js`.
7. Navigate to a server with your bot and experiment with the commands.


### Server Installation
Follow `Step 1` from the `Local Installation` and then follow instructions provided by your specific hosting provider for running NodeJS scripts.



***
### How the codebase works
The codebase is split into different folders for ease of use. 

- `/assets` is used to store emojis for the bot. Any images with a `.png` file extension will automatically be loaded into the application's emoji store.
- `/commands` stores all the commands. Each command exports specific data and should be self-explanatory. There are 3 types: slash commands, prefix commands and subcommands. Subcommands are named after the directory they fall under and the name provided in their export.
- `/data` holds config files for data stored by the bot. Self-explanatory.
- `/utils` holds utilities such as accessing emojis, using text coloring in the console, saving data, etc.


If you wish to add commands in the future, you shouldn't need to touch index.js. Simply follows the format of a command using the same command as yours and fill in the data and async execute with your logic flow.



***
Made with love by Tactor.
❤️
