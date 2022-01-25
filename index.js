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

io.on("connection", (socket) => {
	console.log("Client connected");

	// Create new game
	socket.on("createNewGame", () => {
		const gameId = Math.floor(1000 + Math.random() * 9000).toString();
		socket.emit("newGameCreated", gameId);
		socket.join(gameId);
	});

	// Join a game
	socket.on("joinGame", (gameId) => {
		socket.join(gameId);
		socket.to(gameId).emit("joinedGame");
	});

	// Start the game
	socket.on("startGame", (gameId) => {
		socket.to(gameId).emit("hostReady");
	});

	// Disconnect
	socket.on("disconnect", () => {
		console.log("Client disconnected");
	});
});

server.listen(port, () => console.log(`Listening on port ${port}`));
