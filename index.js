require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

var utils = require("./utils");

const io = socketIo(server, {
	cors: {
		origin: process.env.APP_URL,
		methods: ["GET", "POST"],
	},
});

const games = {};
let playersOnline = [];

// games = {
//    [gameId]: {
// 	     hostId: <socket.id>,
// 	     clientId: <socket.id>,
// 	     cells: []
// 	  }
// }

const drawStartingId = (gameId) => {
	const ids = [games[gameId]["hostId"], games[gameId]["clientId"]];
	return ids[Math.floor(Math.random() * ids.length)];
};

io.on("connection", (socket) => {
	console.log("Client connected");

	// Update players online count
	if (!playersOnline.includes(socket.id)) {
		playersOnline.push(socket.id);
	}
	io.emit("PLAYERS_ONLINE_COUNT", playersOnline.length);

	// Create new game
	socket.on("CREATE_NEW_GAME", () => {
		const gameId = Math.floor(10000 + Math.random() * 90000).toString();
		socket.join(gameId);

		io.to(socket.id).emit("NEW_GAME_CREATED", {
			gameId: gameId,
			userId: socket.id,
		});
		games[gameId] = { hostId: socket.id };

		console.log(`ID ${socket.id} created game ${gameId}`);
	});

	// Client trying to join a game
	socket.on("JOIN_GAME", (gameId) => {
		if (games[gameId] && !games[gameId]["clientId"]) {
			const hostId = games[gameId]["hostId"];

			socket.join(gameId);
			games[gameId]["clientId"] = socket.id;

			io.to(socket.id).emit("JOINED_GAME", {
				gameId: gameId,
				userId: socket.id,
				hostId: hostId,
			});

			io.to(hostId).emit("CLIENT_READY", { clientId: socket.id });

			console.log(`ID ${socket.id} joining game ${gameId}`);
		} else {
			io.to(socket.id).emit("GAME_NOT_FOUND");
		}
	});

	// Start the game
	socket.on("START_GAME", (gameId) => {
		const clientId = games[gameId]["clientId"];

		io.to(clientId).emit("HOST_READY");

		const startingId = drawStartingId(gameId);
		games[gameId]["cells"] = utils.initialCells;
		io.in(gameId).emit("RESET_BOARD");

		io.in(gameId).emit("TURN_INFO", {
			nextTurnId: startingId,
			cells: games[gameId]["cells"],
		});

		console.log(`Host ready to start game ${gameId}`);
	});

	// Receive turn info
	socket.on("SUBMIT_TURN", ({ gameId, userId, cells }) => {
		if (!games[gameId]) return;

		const nextTurnId =
			userId === games[gameId]["hostId"]
				? games[gameId]["clientId"]
				: games[gameId]["hostId"];

		io.in(gameId).emit("TURN_INFO", {
			nextTurnId: nextTurnId,
			cells: cells,
		});

		const winner = utils.checkWinner(cells);
		if (winner) {
			io.in(gameId).emit("WINNER_FOUND", {
				winnerId: winner,
			});
		}
	});

	socket.on("QUIT_GAME", (gameId) => {
		if (!gameId) return;

		socket.leave(gameId);
		io.in(gameId).emit("OPPONENT_LEFT");
	});

	// Disconnect
	socket.on("disconnect", () => {
		// Update players online count
		playersOnline = playersOnline.filter((id) => id !== socket.id);
		io.emit("PLAYERS_ONLINE_COUNT", playersOnline.length);

		console.log(`Client ${socket.id} disconnected`);

		// Remove game when the host or client disconnects
		const gameToEnd = Object.keys(games).find(
			(gameId) =>
				games[gameId].hostId === socket.id ||
				games[gameId].clientId === socket.id
		);

		if (gameToEnd) {
			// Send notice of opponent leaving
			socket.leave(gameToEnd);
			io.in(gameToEnd).emit("OPPONENT_LEFT");

			delete games[gameToEnd];
		}
	});
});

server.listen(port, () => console.log(`Listening on port ${port}`));
