var  express=require("express");
var fs = require('fs');
var app=express();
app.use(express.static("public"));
app.set("view engine","ejs");
app.set("views","./views");
app.listen(process.env.PORT || 3000);
var request=require("request");
var cheerio=require("cheerio");

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
			var list_link=$(body).find("div h3.yt-lockup-title a");
			var list_image=$(body).find("div span.yt-thumb-simple img");
			list_image.each(function(i,e){
				if(e["attribs"]["data-thumb"]!=null){
				array_image.push(e["attribs"]["data-thumb"]);
			}else{
				array_image.push(e["attribs"]["src"]);
			}

			});
			var i=0;
			//console.log(array_image.length);

			list_link.each(function(i,e){
				json.push({name:$(this).text(),link:e["attribs"]["href"],image:array_image[i]});
				i++;
			});
			//console.log(JSON.stringify(json));
			res.writeHead(200,{"Content-Type":"application/json"});
			res.end("{Data:"+JSON.stringify(json)+"}");
			//res.render("trangchu",{html:body});
		}
	});
});