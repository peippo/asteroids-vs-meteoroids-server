const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

var utils = require("./utils");

const io = socketIo(server, {
	cors: {
		origin: "*",
	},
});

const games = {};

// {
// 	[gameId]: {
// 		hostId: socket.id,
// 		clientId: socket.id,
// 		cells: []
// 	}
// }

const drawStartingId = (gameId) => {
	const ids = [games[gameId]["hostId"], games[gameId]["clientId"]];
	return ids[Math.floor(Math.random() * ids.length)];
};

io.on("connection", (socket) => {
	console.log("Client connected");

	// Create new game
	socket.on("createNewGame", () => {
		const gameId = Math.floor(10000 + Math.random() * 90000).toString();
		socket.emit("newGameCreated", { gameId: gameId, userId: socket.id });
		socket.join(gameId);
		games[gameId] = { hostId: socket.id, cells: utils.initialCells };

		console.log(`ID ${socket.id} created game ${gameId}`);
	});

	// Client trying to join a game
	socket.on("joinGame", (gameId) => {
		if (games[gameId] && !games[gameId]["clientId"]) {
			socket.join(gameId);
			io.to(gameId).emit("joinedGame", {
				gameId: gameId,
				userId: socket.id,
				hostId: games[gameId]["hostId"],
			});
			socket.to(gameId).emit("clientReady", { clientId: socket.id });
			games[gameId]["clientId"] = socket.id;

			console.log(`ID ${socket.id} joining game ${gameId}`);
		} else {
			socket.emit("gameNotFound");
		}
	});

	// Start the game
	socket.on("startGame", (gameId) => {
		socket.to(gameId).emit("hostReady");

		const startingId = drawStartingId(gameId);
		io.to(gameId).emit("turnInfo", {
			nextTurnId: startingId,
			cells: games[gameId]["cells"],
		});

		console.log(`Host ready to start game ${gameId}`);
	});

	// Receive turn info
	socket.on("sendTurn", ({ gameId, userId, cells }) => {
		const nextTurnId =
			userId === games[gameId]["hostId"]
				? games[gameId]["clientId"]
				: games[gameId]["hostId"];

		io.to(gameId).emit("turnInfo", {
			nextTurnId: nextTurnId,
			cells: cells,
		});

		const winner = utils.checkWinner(cells);
		if (winner) {
			io.to(gameId).emit("winnerFound", {
				winnerId: winner,
			});
		}
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
