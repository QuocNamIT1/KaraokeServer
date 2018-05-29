const CLIENT_CONNECTION="connection";
const SECRET_STRING = "quocnam123";

var moment = require('moment');
moment().format();
var express=require("express");
var app=express();

var jwt = require('jwt-simple');

var fs = require('fs');
var request=require("request");
var cheerio=require("cheerio");

app.set('jwtTokenSecret', SECRET_STRING);
app.use(express.static("./public"));
app.set("view engine","ejs");
app.set("views","./views");

var expires = moment().add(1,'days').valueOf();

var socketArray = [];

var models = require('./model-mongoose/room');
models.connect("mongodb://quocnam123:Quocnam123@ds149324.mlab.com:49324/room", function(err) {
    if(err)
    throw err;
});

models.DropDatabase();
models.getAllKaraokeRoom();

var server=require("http").Server(app);
server.listen(process.env.PORT || 3000);
var io=require("socket.io")(server);
// io.set("heartbeat timeout", 10000);
// io.set("heartbeat interval", 5);


var decodedToken = function(socket,contentJson,callback,errorNoTToken)
{

	var content=JSON.parse(contentJson);
	if(!content.Token || !content.Token.length)
	{
		if(errorNoTToken != null)
		{
			errorNoTToken(content);
			return;
		}
		var response = {
			Data : "Không tìm thấy room"
		};
		var responseJson = JSON.stringify(response);
		console.log("response_not_Token");	
		socket.emit("response_not_exist_room",responseJson);
		return;
	}
	var tokenObject = jwt.decode(content.Token, app.get('jwtTokenSecret'));
	var expires=new Date(tokenObject.exp).getTime();
	if(expires>Date.now())
	{
		models.findRoomById(tokenObject.room_id,function(room)
		{
			callback(room,tokenObject,content);
		},function()
		{
			var response = {
			Data : "Không tìm thấy room"
			};
			var responseJson = JSON.stringify(response);
			console.log("response_not_exist_room");	
			socket.emit("response_not_exist_room",responseJson);	
		});
	}
	else
	{
		var response = {
			Data : "Token đã hết hạn"
		};
		var responseJson = JSON.stringify(response);	
		console.log("response_not_exist_room");
		socket.emit("response_expired_token",responseJson);	
	}	
};


io.on(CLIENT_CONNECTION,function(socket)
{
	console.log("connection "+socket.id);
	socketArray.push(socket);
	socket.emit("connection");
	

	socket.on("control_play_or_pause",function(contentJson)
	{
		console.log("control_play_or_pause");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
					console.log("control_play_or_pause status:" +room.status_player);
			if(room.status_player!="waiting")
			{
				room.is_playing=content.DataObject;
				models.updateRoom(room,function()
				{
					var response = {
						Data : content.DataObject
					};
					var responseJson = JSON.stringify(response);
					io.in(room.room_name).emit("response_control_play_or_pause_success",response);
					console.log("response_control_play_or_pause_success :" + content.DataObject);
				},function(err)
				{
					console.log("state_player_change_error");	
				});
			}
		});
	});

	socket.on("control_full_screen",function(contentJson)
	{
		console.log("control_full_screen");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			console.log("control_full_screen status:" +room.status_player);
			if(room.status_player!="waiting")
			{
				room.is_fullscreen=content.DataObject;
				models.updateRoom(room,function()
				{
					var response = {
						Data : content.DataObject
					};
					var responseJson = JSON.stringify(response);
					io.in(room.room_name).emit("response_control_full_screen_success",response);
					console.log("response_control_full_screen_success :" + content.DataObject);
				},function(err)
				{
					console.log("state_player_change_error");	
				});
			}
		},function(content)
		{

			// Note:khi bấm back thì set not full screen
			console.log("control_full_screen_error "+socket.room_id);
			models.findRoomById(socket.room_id,function(room)
			{
							console.log("control_full_screen_error 1"+JSON.stringify(room));
				room.is_fullscreen=content.DataObject;
				models.updateRoom(room,function()
				{
					var response = {
						Data : content.DataObject
					};
					var responseJson = JSON.stringify(response);
					io.in(room.room_name).emit("response_control_full_screen_success",response);
					console.log("response_control_full_screen_success :" + content.DataObject);
				});
			});
		});
	});

	socket.on("get_state_player",function(contentJson)
	{
		console.log("get_state_player");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			console.log("response_get_state_player_success");
			var response = {
				Data : room.is_playing
			};
			var responseJson = JSON.stringify(response);
			socket.emit("response_get_state_player_success",responseJson);	
		});
	});

	socket.on("get_state_full_screen",function(contentJson)
	{
		console.log("get_state_player");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			console.log("response_get_state_full_screen_success");
			var response = {
				Data : room.is_fullscreen
			};
			var responseJson = JSON.stringify(response);
			socket.emit("response_get_state_full_screen_success",responseJson);	
		});
	});	

	socket.on("request_delete_video",function(contentJson)
	{
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			var videoId=content.Content;
			models.deleteVideo(room,videoId,function(deletedVideo)
			{
				var response = {
					Data : "Đã xóa bài hát "+ deletedVideo.name + " ."
				};
				console.log("response_delete_video_success");						
				io.in(room.room_name).emit("response_delete_video_success",response);	
			},function(err)
			{
				console.log("response_delete_video_error : delete video error");
			});
		});
	});

	socket.on("request_insert_video_to_top_queue",function(contentJson)
	{
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			var videoId=content.Content;

			models.insertToTopTheQueue(room,videoId,function(video)
			{
				var response = {
					Data : "Đã chèn bài hát "+ video.name + " vào đầu danh sách."
				};
				console.log("response_insert_video_to_top_queue_success");						
				io.in(room.room_name).emit("response_insert_video_to_top_queue_success",response);
			},function(err)
			{
				console.log("response_insert_video_to_top_queue_error ." );
					// var response = {
					// 	Data : "Không có video đang chờ"
					// };
					// var responseJson = JSON.stringify(response);
					// socket.emit("response_next_video_error",responseJson);
			});
		});
	});

	socket.on("request_next_video",function(contentJson)
	{
		console.log("request_next_video");
		models.findRoomById(socket.room_id,function(room)
		{	
			models.getTopVideos(room,function(video)
			{
				var response = {
					Data : video
				};
				var responseJson = JSON.stringify(response);
				console.log("response_next_video_success :" + socket.room_id + "  "+ room.room_id);						
				io.in(room.room_name).emit("response_next_video_success",responseJson);	
			},function(err)
			{
				console.log("require next video error :" + err);
				console.log("response_next_video_error : null" );
				var response = {
					Data : "Không có video đang chờ"
				};
				var responseJson = JSON.stringify(response);
				socket.emit("response_next_video_error",responseJson);
			});
		},function(err)
		{
			console.log("Không tìm thấy phòng ");
		});
	});

	socket.on("control_skip_current_video",function(contentJson)
	{
		console.log("control_skip_current_video");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			models.getTopVideos(room,function(video)
			{
				if(video!=null)
				{
					var response = {
						Data : video
					};
					var responseJson = JSON.stringify(response);
					models.deleteVideo(room,video.id,function(deletedVideo)
					{
						console.log("response_skip_current_video_success");						
						io.in(room.room_name).emit("response_skip_current_video_success",responseJson);	
					},function(err)
					{
						console.log("Delete Video Error :" +err);	
					});
				}
				else
				{
					console.log("response_skip_current_video_error : null" );
					var response = {
						Data : "Không có video đang chờ"
					};
					var responseJson = JSON.stringify(response);
					socket.emit("response_skip_current_video_error",responseJson);
				}
			},function(err)
			{
				console.log("skip current video error :" + err);
			});
		});
	});

	socket.on("state_player_change",function(contentJson)
	{
		var content=JSON.parse(contentJson);
		console.log("state_player_change :" + content.Content);
		models.findRoomById(socket.room_id,function(room)
		{
			switch(content.Content)
			{
				case "on_ad_started":
				case "on_error":
				case "on_loading":
				case "on_loaded":
				case "on_video_end":
					room.is_playing=false;
					room.status_player="waiting";
					break;
				case "on_video_started":
					room.status_player="playing";
					room.is_playing=true;
					break;
			}
			models.updateRoom(room,function()
			{
				console.log("state_player_change_success :" + room.is_playing);
				var response = {
					Data : room.is_playing
				};
				var responseJson = JSON.stringify(response);
				socket.to(room.room_name).emit("state_player_change",responseJson);
			},function(err)
			{
				console.log("state_player_change_error");	
			});
		},function(err)
		{
			console.log("state_player_change_error : findId error");
		});	
	});
	socket.on("create_room",function(contentJson)
	{
		console.log("create_room");
		var data=JSON.parse(contentJson);
		models.create(data.Content,socket.id, function(room)
			{
				console.log("create room success:"+room.room_id);
				socket.room_id=data.Content;
				socket.join(data.Content);
				socket.isOwner=true;

				console.log("response_create_room_success :" + data.Content);
				var response = {
					Data : data.Content
				};
				var responseJson = JSON.stringify(response);
				socket.emit("response_create_room_success",responseJson);
			},function(err)
			{
				console.log("response_create_room_error :" + err);
				var response = {
					Data : "Tạo room không thành công"
				};
				var responseJson = JSON.stringify(response);
				socket.emit("response_create_room_error",responseJson);
			});
	});

	socket.on("check_exist_room_by_token",function(contentJson)
	{
		console.log("check_exist_room_by_token");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			console.log("response_exist_room_success" + JSON.stringify(room));
			var response = {
				Data : tokenObject.room_id
			};
			var responseJson = JSON.stringify(response);	
			socket.join(room.room_name);
			socket.emit("response_exist_room_success",responseJson);	
		});
	});

	socket.on("join_room",function(contentJson)
	{
		console.log("join_room");
		var data=JSON.parse(contentJson);
		console.log(contentJson);
		models.findRoomById(data.Content,function(room)
		{
			{
				socket.join(room.room_name);
				socket.room_id=room.room_id;
				var token = jwt.encode({
					  room_id: room.room_id,
					  exp: expires
					}, app.get('jwtTokenSecret'));
				var response = {
					Data : token
				};

				var responseJson = JSON.stringify(response);
				socket.emit("response_join_room_success",responseJson);
				console.log("join room success " + room.room_id + "\n  expires"+expires );
			}
		},function(err)
		{
			console.log("join room error "+ err);
			var response = {
					Data : "Không tìm thấy Room cần kết nối"
				};
			var responseJson = JSON.stringify(response);
			socket.emit("response_join_room_error",responseJson);
		});
	});

	socket.on("get_room_by_room_id",function(contentJson)
	{
		console.log("get_room_by_room_id");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			
			var response = {
				Data : room
			};
			var responseJson = JSON.stringify(response);
			console.log("respone_get_room_by_room_id_success");
			
			socket.emit("respone_get_room_by_room_id_success",responseJson);
		});
	});

	socket.on("request_add_video_to_queue",function(contentJson)
	{
		console.log("request_add_video_to_queue");
		decodedToken(socket,contentJson,function(room,tokenObject,content)
		{
			var video= content.DataObject;

			if(room.status_player=="waiting")
			{
				var response = {
					Data : video
				};
				var responseJson = JSON.stringify(response);
				io.in(room.room_name).emit("response_add_video_to_queue_success",responseJson);
				console.log("send event play video just added success");
				return;
			}

			models.addVideoToTheRoom(room,video,function()
			{
				var response = {
					Data : video
				};
				var responseJson = JSON.stringify(response);
				io.in(room.room_name).emit("response_add_video_to_queue_success",responseJson);
				console.log("added video to the queue successfully");
			},function(err)
			{
				var response = {
				Data : "Không tìm thấy room cần kết nối"
				};
				var responseJson = JSON.stringify(response);
				socket.emit("response_add_video_to_queue_error",responseJson);
				console.log("updateVideo error "+err);
			});
		});
	});

	socket.on("disconnecting",function()
	{
		console.log("disconnecting  "+socket.id );
		//Xoa toan bo du lieu neu la phat video
		if(socket.isOwner)
		{
			models.deleteRoom(socket.room_id,function(room_name)
			{
				console.log("Delete room name :" +room_name);
				var response = {
				Data : "Room đã bị xóa"
				};
				var responseJson = JSON.stringify(response);
				socket.to(room_name).emit("response_delete_room_success",responseJson);
			},function(err)
			{
				console.log("Delete Room Error :" + err);
			});
		}
	});

	socket.on("disconnect",function()
	{
		console.log("disconnect  "+socket.id );
		socketArray = socketArray.filter(sk => sk.id != socket.id);
		//Xoa toan bo du lieu neu la phat video
		// if(socket.isOwner)
		// {
		// 	models.deleteRoom(socket.room_id,function()
		// 	{
		// 		console.log("Delete room Id :" +socket.room_id);
		// 	},function(err)
		// 	{
		// 		console.log("Delete Room Error :" + err);
		// 	});
		// }
	});
});


app.get("/check_token",function(req,res)
{

	var token=req.query.token; 

	console.log("Token :" + token);
	var decoded = jwt.decode(token, app.get('jwtTokenSecret'));
	console.log("room_id :" +decoded.room_id);
	console.log("decoded.exp: "+ new Date(decoded.exp).getTime() + "    Date.Now :" + Date.now());
	var expires=new Date(decoded.exp).getTime();
	if(expires>Date.now())
	{
		console.log("Exp success");
		models.findRoomById(decoded.room_id,function(room)
		{
			res.writeHead(200,{"Content-Type":"application/json"});
			res.end("{RoomId:"+decoded.room_id+",IsSuccess:true}");
		},function(err)
		{
			console.log("Room was deleted");
			res.writeHead(200,{"Content-Type":"application/json"});
			res.end("{RoomId:"+decoded.room_id+",IsSuccess:false}");
		});
	}
	else
	{
		console.log("Exp failed");
		res.writeHead(200,{"Content-Type":"application/json"});
		res.end("{RoomId:null,IsSuccess:false}");
	}
});

app.get("/check_exist_room",function(req,res)
{
	var room_id=req.query.roomId; 
	console.log("check_exist_room :" +room_id);
	models.findRoomById(room_id,function(room)
	{
		res.writeHead(200,{"Content-Type":"application/json"});
		res.end("{Data:true}");
	},function(err)
	{
		console.log("Room was deleted");
		res.writeHead(200,{"Content-Type":"application/json"});
		res.end("{Data:false}");
	});
});

app.get("/get_song",function(req,res)
{

	var string_search=req.query.name; 
	console.log(string_search);
	request("https://www.youtube.com/results?search_query="+string_search,
		function(error,response,body){
		if(error){
			console.log(error);
		}else{
			var json=[];
			var array_image=[];
			$ =cheerio.load(body);

        fs.writeFile("test.txt", body, function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
        	var listBody= $(body).find("div.yt-lockup-dismissable.yt-uix-tile");
        	var tmp=$(listBody[4]).find("div.yt-lockup-meta ul.yt-lockup-meta-info li");
        	
        	//console.log($(tmp));
        	listBody.each(function(i,e)
        	{
        		var linkVideo=$(listBody[i]).find("div.yt-lockup-content h3.yt-lockup-title a");
				var viewVideo=$(listBody[i]).find("div.yt-lockup-meta ul.yt-lockup-meta-info li");
				var timeVideo=$(listBody[i]).find("div.yt-lockup-content h3.yt-lockup-title span");
				var imageVideo=$(listBody[i]).find("div.yt-thumb.video-thumb span.yt-thumb-simple img");


				var image_video="";
				if($(imageVideo).attr("src").substring(0,8)=="https://")
				{
					image_video=$(imageVideo).attr("src");
				}	
				else
				{
					image_video=$(imageVideo).attr("data-thumb");
				}

        		if($(viewVideo).length>0)
	        	{
	        		if($(viewVideo).length==2)
	        		{
						json.push({name:$(linkVideo).text(),link:$(linkVideo).attr("href"),image:image_video,duration:$(timeVideo).text(),view:$(viewVideo[1]).text()});
	        		}
        		}
        	});

			res.writeHead(200,{"Content-Type":"application/json"});
			res.end("{Data:"+JSON.stringify(json)+"}");
			//res.render("trangchu",{html:body});
		}
	});
});