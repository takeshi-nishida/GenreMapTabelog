let p5canvas;
let mx, my, dx, dy, rx, ry;
let range;
let loadingCount = 0;

function setup(){
  p5canvas = createCanvas(730, 730);
  p5canvas.mouseReleased(mouseReleasedInCanvas);
  p5canvas.mouseClicked(mouseClickedInCanvas);
  p5canvas.mousePressed(mousePressedInCanvas);

  let ranks = document.querySelectorAll(".areatop-top3");
  for(let i = 0; i < ranks.length; i++){
    let e = ranks[i];
    e.parentNode.removeChild(e);
  }

  let side = document.querySelectorAll("#js-leftnavi-genre-trigger.list-sidebar__balloon-trigger");
  for(let i = 0; i < side.length; i++){
    let e = side[i];
    e.parentNode.removeChild(e);
  }
}

function draw(){
  loadModule();
  background(255);
  stroke(245, 222, 179);
  strokeWeight(3);
  line(width / 2, 0, width / 2, height);
  line(0, height / 2, width, height / 2);
  noStroke();
  fill(210, 180, 140);
  text("あっさり", 0, height / 2);
  text("こってり", width - 50, height / 2);
  text("ゆっくり", width / 2, 13);
  text("はやい", width / 2, height);

  for(let i = 0; i < genres.length; i++){
    const g = genres[i];
    const x = map(g.weight, 1, 5, 0, width);
    const y = map(g.speed, 5, 1, 0, height);
    noStroke();
    if(mx <= x && x <= dx && my <= y && y <= dy){
      fill(255,0,0);
    }else{
      fill(0);
    }
    text(g.name, x, y);
  }

  noFill();
  stroke(0);
  strokeWeight(1);
  if(rx > 0 && ry > 0) rect(mx, my, rx, ry);

  if(loadingCount > 0) text("Loading ... " + loadingCount, 8, 16);
  else text("Loaded " + Object.keys(records).length + " restaurants", 8, 16);
}

function mouseClickedInCanvas(){
//  mx = null;
}

function mousePressedInCanvas(){
  mx = mouseX;
  my = mouseY;
  dx = 0;
  dy = 0;
  rx = 0;
  ry = 0;
}

function mouseDragged(){
  dx = mouseX;
  dy = mouseY;
  rx = dx - mx;
  ry = dy - my;
}

function mouseReleasedInCanvas(){
  let ok = [];
  for(let i = 0; i < genres.length; i++){
    const g = genres[i];
    const x = map(g.weight, 1, 5, 0, width);
    const y = map(g.speed, 5, 1, 0, height);
    if(mx <= x && x <= dx && my <= y && y <= dy){
      ok.push(g.name);
    }
  }
  console.log(ok);
  if(ok.length > 0){
    const rs = getRecordsByGenreName(ok);
    sortRecords(rs);
    replaceResults(rs.slice(0, 20)); // 上位20件を表示
  }
}

// ----------------------------------------------------------------------------
// Adding genremap
// ----------------------------------------------------------------------------

function loadModule(){
  if(document.getElementById("ex-inner")) return;
  let m = document.createElement("div");
  m.className = "module";

  const right = document.querySelector(".list-condition");
  if(right){
    right.appendChild(m, right.firstChild);

    const url = chrome.runtime.getURL("module.html");
    loadFileToElement(m, url, afterLoad);
    hyperFetch(); // .list-condition があるときだけ読み込む
  }
}

function afterLoad(){
  p5canvas.parent("ex-inner");
}


function loadFileToElement(element, url, callback){
  let xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function(){
    if(xhr.readyState == 4 && xhr.status == 200){
      if(document.getElementById("ex-inner")) return;
      element.innerHTML = xhr.responseText;
      callback();
    }
  }
  xhr.open('GET', url, true);
  xhr.send();
}


// ----------------------------------------------------------------------------
// Loading genre
// ----------------------------------------------------------------------------

var records = {};

// <th class="rst-catlst__cat1" rowspan="2"><a href="/rstLst/RC13/">焼肉・ホルモン</a></th>
// <dt class="list-balloon__table-title"><a href="https://tabelog.com/hyogo/C28102/rstLst/RC/">レストラン</a></dt>
// <th class="rst-catlst__cat1" rowspan="13"><a href="/rstLst/washoku/">和食</a></th>
function getGenreUrls(){
  var titles = document.querySelectorAll(".list-balloon__table-title > a");
  var urls = [];
  titles.forEach(a => urls.push(a.getAttribute("href")));
  return urls;
}

function hyperFetch(){
  var baseURL = location.href.endsWith("/") ? location.href.substr(0, location.href.length - 1): location.href;
  var xhr = new XMLHttpRequest();
  xhr.responseType = "document";
  xhr.onload = function(){
    var titles = xhr.response.querySelectorAll(".rst-catlst__cat2 a");
    loadingCount = titles.length;
    titles.forEach(a => fetch(baseURL + a.getAttribute("href")));
  };
  xhr.open("GET", "https://tabelog.com/cat_lst/");
  xhr.send();
}

function fetch(url){
  var xhr = new XMLHttpRequest();
  xhr.responseType = "document"
  xhr.onload = function(){
    console.log("Successfully fetched:" + url);
    loadingCount--;
    var results = xhr.response.querySelectorAll("li.list-rst");
    results.forEach(r => {
      const k = r.getAttribute("data-detail-url");
      records[k] = r;
    });
  };
  xhr.open("GET", url);
  xhr.send();
}

// <span class="list-rst__area-genre cpy-area-genre"> 王子公園駅 401m / 沖縄料理、鳥料理、居酒屋</span>
function getRecordsByGenreName(names){
  return Object.values(records).filter(r => {
    var genreText = r.querySelector("span.list-rst__area-genre").innerText;
    return typeof genreText == "string" && names.some(name => genreText.indexOf(name) >= 0);
  });
}

function sortRecords(rs){
  rs.sort((a, b) => getRating(b) - getRating(a));
}

function getRating(record){
  const ratingElement = record.querySelector(".list-rst__rating-val");
  return ratingElement ? Number(ratingElement.innerText) : 0;
}

function replaceResults(es){
  var target = document.querySelector("ul.rstlist-info");
  target.innerHTML = "";
  es.forEach(e => {
    e.querySelectorAll("img").forEach(i => {
      i.setAttribute("src", i.getAttribute("data-original"))
    });
    var calendar = e.querySelector(".list-rst__calendar");
    if(calendar){
      calendar.parentNode.removeChild(calendar);
    }
    target.appendChild(e);
  });
}

// 使用法1: 前もって各ジャンルのレストラン情報を読み込んでおく
// getGenreUrls().forEach(url => { fetch(url) });

// 使用法2: ジャンルを指定してそのジャンルの情報を表示
//replaceResults(getRecordsByGenreName("居酒屋"));
