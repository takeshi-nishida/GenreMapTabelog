let p5canvas;
let mx, my, dx, dy, rx, ry;
let range;
let loadingCount = 0;

function setup(){
  loadModule();
  p5canvas = createCanvas(730, 730);
  p5canvas.mouseReleased(mouseReleasedInCanvas);
  p5canvas.mouseClicked(mouseClickedInCanvas);
  p5canvas.mousePressed(mousePressedInCanvas);

  document.getElementById('js-leftnavi-genre-trigger').parentNode.style.display = 'none';
}

function draw(){
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
    if(!count[g.name]) continue;
    const x = map(g.weight, 1, 5, 0, width);
    const y = map(g.speed, 5, 1, 0, height);
    noStroke();
    if(mx <= x && x <= dx && my <= y && y <= dy) fill(255,0,0);
    else if(count[g.name] < 3) fill(192);
    else fill(0);
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
    genreFilter = createGenreNameFilter(ok);
    updateList();
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
// Fetch records from Tabelog server
// ----------------------------------------------------------------------------

let records = {};

function hyperFetch(){
  const baseUrl = getBaseUrl();
  chrome.storage.local.get(baseUrl, results => {
    if(results[baseUrl]){
      console.log(baseUrl + " loading from cache.");
      loadRecords(results[baseUrl]);
    }
    else{
      console.log(baseUrl + " is not cached. Start fetching.")
      var xhr = new XMLHttpRequest();
      xhr.responseType = "document";
      xhr.onload = function(){
        var titles = xhr.response.querySelectorAll(".rst-catlst__cat2 a");
        loadingCount = titles.length;
        titles.forEach(a => fetch(baseUrl + a.getAttribute("href")));
      };
      xhr.open("GET", "https://tabelog.com/cat_lst/");
      xhr.send();
    }
  });
}

function getBaseUrl(){
  const url = new URL(location.href);
  if(url.search){
    var result = [ url.origin ];
    result.push(url.searchParams.get('pal'));
    result.push(url.searchParams.get('LstPrf'));
    result = result.filter(s => s);
    if(result.length > 1) return result.join('/');
  }
  if(url.pathname.endsWith('/rstLst/')){
    return url.origin + url.pathname.slice(0, -8);
  }
  else if(url.pathname.endsWith('/')){
    return url.origin + url.pathname.slice(0, -1);
  }
  else return url.origin + url.pathname;
}

function fetch(url){
  var xhr = new XMLHttpRequest();
  xhr.responseType = "document"
  xhr.onload = function(){
    console.log("Successfully fetched:" + url);
    var results = xhr.response.querySelectorAll(".list-rst");
    results.forEach(r => {
      const k = new URL(r.getAttribute("data-detail-url")).pathname;
      records[k] = r;
    });
    loadingCount--;
    if(loadingCount == 0){
      applyBudgetFilter();
      storeRecords();
    }
  };
  xhr.open("GET", url);
  xhr.send();
}

// ----------------------------------------------------------------------------
// Load/store records from/to cache
// ----------------------------------------------------------------------------

function loadRecords(keys){
  chrome.storage.local.get(keys, htmls => {
    keys.forEach(k => {
      const t = document.createElement('template');
      t.innerHTML = LZString.decompressFromUTF16(htmls[k]).trim();
      records[k] = t.content.firstChild;
    });
    applyBudgetFilter();
  });
}

function storeRecords(){
  const baseUrl = getBaseUrl();
  const urls =  Object.keys(records);
  chrome.storage.local.set({ [baseUrl]: urls });
  const elements = urls.reduce((o, k) => { o[k] = LZString.compressToUTF16(records[k].outerHTML); return o; }, {});
  chrome.storage.local.set(elements);
}

// ----------------------------------------------------------------------------
// Update List
// ----------------------------------------------------------------------------

let recordsWithinBudget = [];
let genreFilter = r => true;
let budgetFilter = r => true;
const count = {};

function applyBudgetFilter(){
  recordsWithinBudget = Object.values(records).filter(budgetFilter);
  updateList();
  updateCount();
}

function updateList(){
  const rs = recordsWithinBudget.filter(genreFilter);
  sortRecords(rs);
  replaceResults(rs.slice(0, 20)); // 上位20件を表示
}

function sortRecords(rs){
  rs.sort((a, b) => getRating(b) - getRating(a));
}

function getRating(record){
  const ratingElement = record.querySelector(".list-rst__rating-val");
  return ratingElement ? Number(ratingElement.innerText) : 0;
}

function replaceResults(es){
  const target = document.querySelector(".rstlist-info");
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

function updateCount(){
  const genreTexts = recordsWithinBudget.map(r => r.querySelector(".list-rst__area-genre").innerText);
  genres.forEach(g => {
    count[g.name] = genreTexts.filter(t => (typeof t == "string" && t.indexOf(g.name) >= 0)).length;
  });
}

// ----------------------------------------------------------------------------
// Genre filter
// ----------------------------------------------------------------------------

// <span class="list-rst__area-genre cpy-area-genre"> 王子公園駅 401m / 沖縄料理、鳥料理、居酒屋</span>
function createGenreNameFilter(names){
  return names.length > 0 ? r => {
    const genreText = r.querySelector(".list-rst__area-genre").innerText;
    return typeof genreText == "string" && names.some(name => genreText.indexOf(name) >= 0);
  } : r => true;
}

// ----------------------------------------------------------------------------
// Budget filter
// ----------------------------------------------------------------------------
const budgets = [null, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000, 20000, 30000];
const radio = document.getElementById('js-simple-form-sidebar').RdoCosTp;
const minBudgetSelect = document.getElementById('lstcos-sidebar');
const maxBudgetSelect = document.getElementById('lstcost-sidebar');

document.getElementById('RdoCosTp_1_sidebar').addEventListener('change', budgetChanged);
document.getElementById('RdoCosTp_2_sidebar').addEventListener('change', budgetChanged);
minBudgetSelect.addEventListener('change', budgetChanged);
maxBudgetSelect.addEventListener('change', budgetChanged);

function getTiming(){ return radio.value; } // 2 = dinner, 1 = lunch
function getMinBudget(){ return budgets[minBudgetSelect.value] }
function getMaxBudget(){ return budgets[maxBudgetSelect.value] }

function budgetChanged(e){
  budgetFilter = createBudgetFilter();
  applyBudgetFilter();
}

// <span class="c-rating__val list-rst__budget-val cpy-dinner-budget-val">￥3,000～￥3,999</span>
// <span class="c-rating__val list-rst__budget-val cpy-lunch-budget-val">￥1,000～￥1,999</span>
function createBudgetFilter(){
  const min = getMinBudget();
  const max = getMaxBudget();
  if(!min && !max) return r => true;
  return r => {
    const text = r.querySelector(getTiming() == 1 ? '.cpy-lunch-budget-val' : '.cpy-dinner-budget-val').innerText.trim();
    if(text == '-') return false;
    const [rmin, rmax] = text.replace(/[￥,]/g, '').split('～');
    return (!min || min < rmin) && (!max || max > rmax);
  }
}
