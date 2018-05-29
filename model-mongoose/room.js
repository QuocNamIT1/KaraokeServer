var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var dburl = undefined;

var moment = require('moment');
moment().format();

exports.connect = function(thedburl, callback) {
    dburl = thedburl;
    mongoose.Promise = global.Promise;
    mongoose.connect(dburl,{ useMongoClient: true});
}
 
exports.disconnect = function(callback) {
    mongoose.disconnect(callback);
}
 
exports.DropDatabase = function()
{
  mongoose.connection.dropDatabase();   
} 

var Room = new Schema({
    room_id : String,
    id_owner : String,
    room_name : String,
    status_player:String,
    is_playing : Boolean,
    is_fullscreen : Boolean,
    video:[{
        id   : String,
        rank : Number,
        link : String,
        name : String,
        image : String,
        duration : String,
        view : String
    }]
});
 
mongoose.model('KaraokeRoom', Room);
var KaraokeRoom = mongoose.model('KaraokeRoom');
 
exports.create = function(room_id,id_owner, success,error) {

    console.log(room_id);
    var karaokeRoom = new KaraokeRoom();
    karaokeRoom.room_id = room_id;
    karaokeRoom.id_owner=id_owner;
    karaokeRoom.room_name=room_id;
    karaokeRoom.status_player="waiting";
    karaokeRoom.is_playing=false;
    karaokeRoom.is_fullscreen=true;
    karaokeRoom.video.length=0;
    karaokeRoom.save(function(err) {
        if(err)
            error(err);
        else
        {
            success(karaokeRoom);
        }
    });
}
 
exports.getAllKaraokeRoom = function() 
{ 
    KaraokeRoom.find({}, function(err, rooms) 
    {
        if(err)
        {
            //error(err);
        }
        else
        {
            rooms.forEach(function(room)
            {
                console.log(JSON.stringify(room) + " \n  ");
            });
        }
    });
}


exports.findRoomById =function(id,success,error)
{
    KaraokeRoom.findOne({ room_id: id }, function(err, room) 
    {
        if(err)
        {
            error(err);
        }
        else
        {
            if(room == null)
            {
                error("room == null")
            }
            else
            {
                success(room);
            }
        }
    });
}


exports.updateStatusPlayerRoom = function(roomId,statusPlayer,success,error)
{

    KaraokeRoom.update({ room_id: roomId }, { status_player:statusPlayer }, { multi: true }, function (err, raw) {
        if (err) {
            return error(err);
        }
        success();
    });
}


exports.updateIsFullScreenRoom = function(roomId,isFullscreen,success,error)
{
    KaraokeRoom.update({ room_id: roomId }, { is_fullscreen:isFullscreen }, { multi: true }, function (err, raw) {
        if (err) {
            return error(err);
        }
        success();
    });
}

exports.updateIsPlayingRoom = function(roomId,isPlaying,success,error)
{
    KaraokeRoom.update({ room_id: roomId }, { is_playing:isPlaying }, { multi: true }, function (err, raw) {
        if (err) {
            return error(err);
        }
        success();
    });
}

exports.updateRoom = function(room,success,error)
{
    KaraokeRoom.update({ room_id: room.room_id }, { is_playing:room.is_playing,is_fullscreen:room.is_fullscreen,status_player:room.status_player,video:room.video }, { multi: true }, function (err, raw) {
        if (err) {
            return error(err);
        }
        success();
    });
}

exports.deleteVideo =function(room,videoId,success,error)
{
    if(room.video!=null)
    {
         var listNewVideo=[];
        var rankOfDeletedVideo;
        listNewVideo.length=0;
        var deletedVideo=room.video.filter(v => v.id== videoId);
        rankOfDeletedVideo=deletedVideo[0].rank;

        //console.log("deleteVideo :" + JSON.stringify(room));
        room.video.forEach(function(v)
        {
            if(v.id ==videoId)
            {
                deletedVideo=v;
            }
            else
            {
                if(v.rank >rankOfDeletedVideo)
                {
                    v.rank--;
                }
                listNewVideo.push(v);
            }
        })
        //console.log("listNewVideo  :" + JSON.stringify(listNewVideo));

        if(deletedVideo==null)
        {
            error("deletedVideo =null");
            return;
        }
    
        KaraokeRoom.update({ room_id: room.room_id }, { video:listNewVideo }, { multi: true }, function (err, raw) {
            if (err) {
                return error(err);
            }
            success(deletedVideo);
        });
    }
    else
    {
        error("video == null");
    }
}

exports.getTopVideos =function(room,success,error)
{
    console.log("room video :" +JSON.stringify(room.video));
    if(room.video!=null && room.video.length >= 1)
    {
        var videoSelected=room.video.filter(v => v.rank== 0);
        console.log("Video id :" + videoSelected[0].id);
        exports.deleteVideo(room,videoSelected[0].id,function(deletedVideo)
        {
            success(videoSelected[0])

        },function(err)
        {
            error(err);
        });
    }
    else
    {
        error("Không có video trong hàng đợi");
    }
}

exports.insertToTopTheQueue =function(room,idVideo,success,error)
{
     if(room.video!=null && room.video.length>1)
        {   var listNewVideo=[];
            var rankOfSelectedVideo;
            listNewVideo.length=0;
            var videoSelected=room.video.filter(v => v.id== idVideo);
            rankOfSelectedVideo=videoSelected[0].rank;

            room.video.forEach(function(v)
            {
                if(v.id!=idVideo)
                {
                    if(v.rank<rankOfSelectedVideo)
                    {
                        v.rank++;
                    }
                }
                else
                {
                    v.rank=0;
                }
                listNewVideo.push(v);

            });

            KaraokeRoom.update({ room_id: room.room_id }, { video:listNewVideo }, { multi: true }, function (err, raw) {
                if (err) {
                    return error(err);
                }
                success(videoSelected[0]);
            });
        }
        else
        {
            error("Không có video trong hàng chờ");
        }
}

exports.addVideoToTheRoom = function(room, video, success,error) 
{    
    if(room.video == null)
    {
        console.log("video null");
        room.video=[];
        room.video.length=0;
    }
    video.rank=room.video.length;
    video.id=moment().valueOf();
    console.log("Video.id:" + video.id);
    room.video.push(video);

    KaraokeRoom.update({ room_id: room.room_id }, { video:room.video }, { multi: true }, function (err, raw) {
        if (err) {
            return error(err);
        }
        success();
    });
}
 
exports.getVideoKaraokeRoom = function(id,success,error) { 
    if (id) 
    {
        KaraokeRoom.findOne({room_id: id }, function(err, room) 
        {
            if(err)
            {
                error(err);
            }
            else
            {
                if(room == null)
                {
                    error("room == null");
                }
                else
                {
                success(room.video);
               }
            }
        });
    }
    else
    {
        error();
    }
}
 
exports.deleteRoom = function(room_id, success,error) 
{
    exports.findRoomById(room_id, function(room) 
    {
        if(room != null)
        {
            var room_name = room.room_name;
            room.remove();
            success(room_name);
        }
        else
        {
            error("room == null");
        }
    },function(err)
    {
        error(err);
    });
}