const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const nodes7 = require("nodes7");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(__dirname));

const plc = new nodes7();

plc.setTranslationCB(tag => tag);

console.log("Connecting to PLC...");

plc.initiateConnection(
{
    host: "127.0.0.1",
    port: 102,
    rack: 0,
    slot: 1
},
(err) =>
{
    if(err)
    {
        console.log("PLC Connection Failed");
        console.log(err);
        return;
    }

    console.log("PLC Connected");

   plc.addItems([
    "M12.0",
    "M12.2",
    "M12.3",
    "M1.3",
    "MD14",
    "M1.7"
]);
}
);

app.get("/start",(req,res)=>
{
    console.log("START Pressed");

    plc.writeItems("M1.3",true,(err)=>
    {
        if(err)
        {
            console.log(err);
            return;
        }

        setTimeout(()=>
        {
            plc.writeItems("M1.3",false);
        },300);
    });

    res.send("OK");
});
app.get("/stop",(req,res)=>
{
    console.log("STOP Pressed");

    plc.writeItems("M1.7",true,(err)=>
    {
        if(err)
        {
            console.log(err);
            return;
        }

        setTimeout(()=>
        {
            plc.writeItems("M1.7",false);
        },300);
    });

    res.send("OK");
});

setInterval(()=>
{
    plc.readAllItems((err,data)=>
    {
        if(err)
        {
            return;
        }

        io.emit("update",
        {
            latch:data["M12.0"],
            star:data["M12.2"],
            delta:data["M12.3"],
            timer:(Number(data["MD14"]) || 0) / 1000
        });
    });

},200);

io.on("connection",(socket)=>
{
    console.log("Phone Connected");
});

server.listen(3000,()=>
{
    console.log("Server Running On Port 3000");
});