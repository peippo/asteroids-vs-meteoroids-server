const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
	cors: {
		origin: "*",
	},
});

const games = {};

io.on("connection", (socket) => {
	console.log("Client connected");

	// Create new game
	socket.on("createNewGame", () => {
		const gameId = Math.floor(10000 + Math.random() * 90000).toString();
		socket.emit("newGameCreated", { gameId: gameId, userId: socket.id });
		socket.join(gameId);
		games[gameId] = { hostId: socket.id };

		console.log(`ID ${socket.id} created game ${gameId}`);
	});

	// Client trying to join a game
	socket.on("joinGame", (gameId) => {
		if (games[gameId]) {
			socket.join(gameId);
			socket.emit("joinedGame", { gameId: gameId, userId: socket.id });
			socket.to(gameId).emit("clientReady");
			games[gameId]["clientId"] = socket.id;

			console.log(`ID ${socket.id} joining game ${gameId}`);
		} else {
			socket.emit("gameNotFound");
		}
	});

	// Start the game
	socket.on("startGame", (gameId) => {
		socket.to(gameId).emit("hostReady");

		console.log(`Host ready to start game ${gameId}`);
	});

	// Disconnect
	socket.on("disconnect", () => {
		console.log(`Client ${socket.id} disconnected`);

		// Remove game when the host or client disconnects
		const gameToEnd = Object.keys(games).find(
			(gameId) =>
				games[gameId].hostId === socket.id ||
				games[gameId].clientId === socket.id
		);

		if (gameToEnd) {
			delete games[gameToEnd];
		}
	});
});

server.listen(port, () => console.log(`Listening on port ${port}`));
