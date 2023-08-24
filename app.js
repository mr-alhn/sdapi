const http = require("http");
const mserver = require("./server");

const port = process.env.PORT || 3000;
const server = http.createServer(mserver);



server.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
