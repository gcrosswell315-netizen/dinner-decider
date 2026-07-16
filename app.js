"use strict";
/* ============================================================
   DINNER DECIDER — application script
   Vanilla JS, no dependencies, no backend, no build step.
   ============================================================ */

/* ---------- tiny DOM helpers ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const live = msg => { $('#live').textContent = ''; setTimeout(()=>{ $('#live').textContent = msg; }, 30); };
let toastTimer;
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), 2600); };
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Only allow safe link schemes when rendering hrefs built from
   possibly-imported/edited restaurant data (host JSON import can
   contain arbitrary strings — never trust it as a URL as-is). */
const SAFE_URL_SCHEMES = ["http:", "https:", "tel:"];
function safeHref(u){
  try{
    const parsed = new URL(String(u), location.href);
    return SAFE_URL_SCHEMES.includes(parsed.protocol) ? parsed.href : "#";
  }catch(e){ return "#"; }
}

/* ---------- secure randomness ---------- */
function rndInt(n){                       // uniform int in [0, n)
  if (n <= 0) return 0;
  if (window.crypto && crypto.getRandomValues){
    const max = Math.floor(0xFFFFFFFF / n) * n;  // rejection sampling: no modulo bias
    const buf = new Uint32Array(1);
    let v;
    do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= max);
    return v % n;
  }
  return Math.floor(Math.random() * n);   // graceful fallback
}
function weightedPick(items, weights){    // returns index
  const total = weights.reduce((a,b)=>a+b, 0);
  if (total <= 0) return rndInt(items.length);
  // scale to integer space for crypto randomness
  const SCALE = 100000;
  let r = rndInt(SCALE) / SCALE * total;
  for (let i=0;i<items.length;i++){ r -= weights[i]; if (r <= 0) return i; }
  return items.length - 1;
}

/* ---------- taxonomies ---------- */
const CUISINES = ["Sushi","Japanese","Soup dumplings","Chinese","Korean","Thai","Vietnamese","Italian","Mexican","Tex-Mex","Indian","Mediterranean","Seafood","Steak","Burgers","Pizza","Barbecue","Cajun","Southern","Brunch","Dessert","Cocktail bar with food","Anything"];
const CUISINE_ICON = {"Sushi":"🍣","Japanese":"🍱","Soup dumplings":"🥟","Chinese":"🥡","Korean":"🍜","Thai":"🌶️","Vietnamese":"🍲","Italian":"🍝","Mexican":"🌮","Tex-Mex":"🫔","Indian":"🍛","Mediterranean":"🥙","Seafood":"🦐","Steak":"🥩","Burgers":"🍔","Pizza":"🍕","Barbecue":"🍖","Cajun":"🦞","Southern":"🍗","Brunch":"🥞","Dessert":"🍨","Cocktail bar with food":"🍸","Anything":"🎲"};
const PRICES = [{v:1,l:"$"},{v:2,l:"$$"},{v:3,l:"$$$"},{v:4,l:"$$$$"},{v:0,l:"Any price"}];
const ATMOS = ["Casual","Lively","Trendy","Cozy","Date-night","Group-friendly","Sushi bar / counter","Outdoor seating","Sports-friendly","Quiet enough to talk","Late-night","Unique or unusual","No preference"];
const DINING = ["Vegetarian options","Vegan options","Gluten-conscious","Halal-friendly","Kid-friendly","Good cocktails","Shareable plates","Reservations available","Walk-in friendly","Private room","Large-group friendly","Happy hour","Open now"];
const MOODS = ["We want something easy","We want to try somewhere new","We want a lively night out","We care most about the food","We want drinks too","We want something inexpensive","We want a hidden gem","We want somewhere impressive but not stuffy","Surprise us"];
const DEALBREAKERS = ["No tasting menus","No extremely expensive restaurants","No chains","No loud clubs","No long waits","No raw fish","No spicy food","No downtown parking","No formal dress code","No restaurants without reservations","No restaurant farther than the selected distance"];

/* ============================================================
   DATA PROVIDERS
   DemoRestaurantProvider: curated local sample data (below).
   LiveRestaurantProvider: placeholder integration points for a
   future restaurant/maps API. Swap providers in one place.
   ============================================================ */
const gq = name => "https://www.google.com/search?q=" + encodeURIComponent(name + " Houston TX");
const gd = name => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(name + ", Houston, TX");

/* Compact builder: fills in defaults + safe demo links.
   NOTE: All entries are SAMPLE DATA. Scores, coordinates, hours and
   flags are illustrative — verify against live sources before relying
   on them. Nothing here is a verified live fact.                    */
function R(o){
  return Object.assign({
    id:o.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
    city:"Houston",
    address:(o.neighborhood||"Houston")+", Houston, TX (sample — verify)",
    latitude:29.76, longitude:-95.37,
    cuisines:[], foodTypes:[],
    priceLevel:2, qualityScore:85, valueScore:80, groupScore:75,
    atmosphereTags:[], dietaryTags:[],
    groupSizeMinimum:1, groupSizeMaximum:8,
    isNew:false, isHiddenGem:false, isLocalFavorite:false,
    hasBar:false, hasCounterSeating:false,
    reservationAvailable:true, walkInFriendly:true,
    website:gq(o.name), menuUrl:gq(o.name+" menu"), directionsUrl:gd(o.name),
    phone:"", openingHours:"Sample hours — verify before going",
    description:"", bestFor:"", dealBreakers:[], imageUrl:""
  }, o);
}

const HOUSTON_DEMO = [
/* ---- Sushi & Japanese (from the original game) ---- */
R({name:"Doko", neighborhood:"Montrose", latitude:29.744, longitude:-95.398, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:3, qualityScore:93, valueScore:78, groupScore:70, atmosphereTags:["Trendy","Date-night","Sushi bar / counter","Lively"], dietaryTags:["Gluten-conscious"], groupSizeMaximum:6, isNew:true, hasBar:true, hasCounterSeating:true, description:"Buzzy modern sushi with a chef-driven counter and creative nigiri.", bestFor:"Date nights and small groups who care about the fish.", dealBreakers:["No raw fish"]}),
R({name:"Oru", neighborhood:"Upper Kirby", latitude:29.732, longitude:-95.423, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:3, qualityScore:91, valueScore:75, groupScore:78, atmosphereTags:["Trendy","Lively","Date-night","Good cocktails"], dietaryTags:["Vegetarian options"], groupSizeMaximum:10, isNew:true, hasBar:true, description:"Sleek izakaya-style plates, sushi and cocktails built for sharing.", bestFor:"Groups that want sushi plus a real bar scene.", dealBreakers:["No raw fish"]}),
R({name:"Koi", neighborhood:"Memorial", latitude:29.781, longitude:-95.545, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:3, qualityScore:88, valueScore:72, groupScore:80, atmosphereTags:["Lively","Trendy","Group-friendly"], groupSizeMaximum:12, hasBar:true, description:"Splashy sushi and robata spot with big-table energy.", bestFor:"Birthday-style group dinners.", dealBreakers:["No raw fish"]}),
R({name:"NoriNori", neighborhood:"Rice Village", latitude:29.716, longitude:-95.416, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:2, qualityScore:87, valueScore:88, groupScore:66, atmosphereTags:["Casual","Sushi bar / counter","Quiet enough to talk"], dietaryTags:["Gluten-conscious"], groupSizeMaximum:5, isHiddenGem:true, hasCounterSeating:true, description:"Compact hand-roll bar — fast, fresh, and fairly priced.", bestFor:"Small groups who want great sushi without the scene.", dealBreakers:["No raw fish"]}),
R({name:"Haii Keii", neighborhood:"Heights", latitude:29.79, longitude:-95.398, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:3, qualityScore:90, valueScore:74, groupScore:72, atmosphereTags:["Trendy","Date-night","Unique or unusual"], groupSizeMaximum:8, isNew:true, hasBar:true, description:"Stylish Heights sushi den mixing classic edomae with playful plates.", bestFor:"Trying somewhere new that still delivers.", dealBreakers:["No raw fish"]}),
R({name:"Casa Kenji", neighborhood:"Montrose", latitude:29.746, longitude:-95.39, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:4, qualityScore:94, valueScore:65, groupScore:55, atmosphereTags:["Date-night","Sushi bar / counter","Quiet enough to talk","Unique or unusual"], groupSizeMaximum:4, hasCounterSeating:true, walkInFriendly:false, description:"Intimate chef's-counter omakase experience.", bestFor:"Special occasions for 2–4 people.", dealBreakers:["No raw fish","No tasting menus","No extremely expensive restaurants","No restaurants without reservations"]}),
R({name:"Ichijiku", neighborhood:"Spring Branch", latitude:29.803, longitude:-95.517, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:3, qualityScore:92, valueScore:80, groupScore:60, atmosphereTags:["Cozy","Sushi bar / counter","Quiet enough to talk"], groupSizeMaximum:6, isHiddenGem:true, hasCounterSeating:true, description:"Quiet, precise sushi bar that regulars try to keep secret.", bestFor:"Purists who care most about the food.", dealBreakers:["No raw fish"]}),
/* ---- Soup dumplings & Chinese (from the original game) ---- */
R({name:"Xiaolong Dumpling", neighborhood:"Chinatown", latitude:29.705, longitude:-95.569, cuisines:["Soup dumplings","Chinese"], foodTypes:["Soup dumplings","Chinese"], priceLevel:1, qualityScore:90, valueScore:95, groupScore:82, atmosphereTags:["Casual","Group-friendly"], dietaryTags:["Vegetarian options"], groupSizeMaximum:10, isLocalFavorite:true, description:"Hand-pleated XLB with a delicate wrapper and rich broth.", bestFor:"Cheap, excellent, zero-pretense group dinners."}),
R({name:"Dough Zone", neighborhood:"Chinatown", latitude:29.702, longitude:-95.56, cuisines:["Soup dumplings","Chinese"], foodTypes:["Soup dumplings","Chinese"], priceLevel:2, qualityScore:86, valueScore:88, groupScore:88, atmosphereTags:["Casual","Group-friendly","Lively"], dietaryTags:["Vegetarian options","Kid-friendly"], groupSizeMaximum:14, description:"Reliable dumpling house with a menu broad enough for any group.", bestFor:"Bigger groups with mixed tastes."}),
R({name:"Dumplings & Noodles", neighborhood:"Chinatown", latitude:29.7, longitude:-95.565, cuisines:["Soup dumplings","Chinese"], foodTypes:["Soup dumplings","Chinese"], priceLevel:1, qualityScore:85, valueScore:93, groupScore:78, atmosphereTags:["Casual","Kid-friendly"], dietaryTags:["Vegetarian options","Kid-friendly"], groupSizeMaximum:8, isHiddenGem:true, description:"Family-run shop doing exactly what the name promises, very well.", bestFor:"Low-key comfort-food nights."}),
R({name:"One Dragon", neighborhood:"Montrose", latitude:29.742, longitude:-95.394, cuisines:["Soup dumplings","Chinese"], foodTypes:["Soup dumplings","Chinese"], priceLevel:2, qualityScore:88, valueScore:85, groupScore:74, atmosphereTags:["Casual","Cozy"], groupSizeMaximum:8, isLocalFavorite:true, description:"Shanghai-style soup dumplings inside the loop — no Chinatown drive needed.", bestFor:"XLB cravings close to Montrose."}),
/* ---- Barbecue / Southern / Cajun ---- */
R({name:"Truth BBQ", neighborhood:"Washington Ave", latitude:29.772, longitude:-95.41, cuisines:["Barbecue"], foodTypes:["Barbecue"], priceLevel:2, qualityScore:95, valueScore:85, groupScore:85, atmosphereTags:["Casual","Group-friendly","Lively"], dietaryTags:["Kid-friendly"], groupSizeMaximum:16, isLocalFavorite:true, reservationAvailable:false, description:"Destination Texas brisket and towering cakes; expect a line for a reason.", bestFor:"Groups who plan around the food.", dealBreakers:["No long waits","No restaurants without reservations"]}),
R({name:"The Pit Room", neighborhood:"Montrose", latitude:29.741, longitude:-95.4, cuisines:["Barbecue","Tex-Mex"], foodTypes:["Barbecue","Tex-Mex"], priceLevel:2, qualityScore:89, valueScore:87, groupScore:82, atmosphereTags:["Casual","Outdoor seating","Group-friendly"], groupSizeMaximum:14, isLocalFavorite:true, reservationAvailable:false, description:"Montrose smokehouse famous for brisket tacos on house-made tortillas.", bestFor:"Casual patio group hangs.", dealBreakers:["No restaurants without reservations"]}),
R({name:"BB's Tex-Orleans", neighborhood:"Heights", latitude:29.802, longitude:-95.41, cuisines:["Cajun","Tex-Mex"], foodTypes:["Cajun","Tex-Mex"], priceLevel:2, qualityScore:83, valueScore:86, groupScore:86, atmosphereTags:["Casual","Lively","Sports-friendly","Late-night"], dietaryTags:["Kid-friendly"], groupSizeMaximum:14, hasBar:true, description:"Crawfish, po'boys and Tex-Mex mashups with game-day energy.", bestFor:"Watch parties and crawfish season."}),
R({name:"Crawfish & Noodles", neighborhood:"Chinatown", latitude:29.699, longitude:-95.575, cuisines:["Cajun","Vietnamese","Seafood"], foodTypes:["Cajun","Vietnamese","Seafood"], priceLevel:2, qualityScore:92, valueScore:84, groupScore:84, atmosphereTags:["Casual","Lively","Group-friendly","Unique or unusual"], groupSizeMaximum:12, isLocalFavorite:true, description:"Houston's iconic Viet-Cajun crawfish — messy, garlicky, unforgettable.", bestFor:"A only-in-Houston group feast.", dealBreakers:["No spicy food"]}),
R({name:"Lucille's", neighborhood:"Museum District", latitude:29.723, longitude:-95.387, cuisines:["Southern","Brunch"], foodTypes:["Southern","Brunch"], priceLevel:3, qualityScore:90, valueScore:78, groupScore:76, atmosphereTags:["Cozy","Date-night","Quiet enough to talk","Outdoor seating"], dietaryTags:["Vegetarian options"], groupSizeMaximum:10, isLocalFavorite:true, hasBar:true, description:"Refined Southern cooking with deep Houston history.", bestFor:"Impressive-but-warm dinners and brunches."}),
R({name:"The Breakfast Klub", neighborhood:"Midtown", latitude:29.741, longitude:-95.378, cuisines:["Southern","Brunch"], foodTypes:["Southern","Brunch"], priceLevel:1, qualityScore:88, valueScore:90, groupScore:80, atmosphereTags:["Casual","Lively","Kid-friendly"], dietaryTags:["Kid-friendly"], groupSizeMaximum:12, isLocalFavorite:true, reservationAvailable:false, description:"Wings-and-waffles institution worth the famous line.", bestFor:"Weekend brunch with the whole crew.", dealBreakers:["No long waits","No restaurants without reservations"]}),
/* ---- Mexican / Tex-Mex ---- */
R({name:"Xochi", neighborhood:"Downtown", latitude:29.753, longitude:-95.36, cuisines:["Mexican"], foodTypes:["Mexican"], priceLevel:3, qualityScore:94, valueScore:76, groupScore:78, atmosphereTags:["Trendy","Date-night","Group-friendly","Good cocktails"], dietaryTags:["Vegetarian options","Gluten-conscious"], groupSizeMaximum:12, hasBar:true, description:"Award-winning Oaxacan moles, masa and mezcal.", bestFor:"Impressing out-of-towners without a dress code.", dealBreakers:["No downtown parking"]}),
R({name:"Hugo's", neighborhood:"Montrose", latitude:29.743, longitude:-95.397, cuisines:["Mexican","Brunch"], foodTypes:["Mexican","Brunch"], priceLevel:3, qualityScore:91, valueScore:77, groupScore:82, atmosphereTags:["Lively","Group-friendly","Date-night","Good cocktails"], dietaryTags:["Vegetarian options"], groupSizeMaximum:14, hasBar:true, description:"Interior-Mexican classic; the Sunday brunch buffet is legendary.", bestFor:"Celebrations and long, loud table dinners."}),
R({name:"The Original Ninfa's on Navigation", neighborhood:"East End", latitude:29.749, longitude:-95.341, cuisines:["Tex-Mex","Mexican"], foodTypes:["Tex-Mex","Mexican"], priceLevel:2, qualityScore:89, valueScore:83, groupScore:88, atmosphereTags:["Lively","Group-friendly","Outdoor seating"], dietaryTags:["Kid-friendly"], groupSizeMaximum:16, isLocalFavorite:true, hasBar:true, description:"Birthplace of the fajita; patio margaritas and tableside legend.", bestFor:"Groups that want classic Houston Tex-Mex."}),
R({name:"La Calle Tacos", neighborhood:"Downtown", latitude:29.759, longitude:-95.362, cuisines:["Mexican"], foodTypes:["Mexican"], priceLevel:1, qualityScore:84, valueScore:92, groupScore:80, atmosphereTags:["Casual","Late-night","Lively"], groupSizeMaximum:10, reservationAvailable:false, description:"Street-style tacos and elotes, open late downtown.", bestFor:"Cheap, fast, late-night fuel.", dealBreakers:["No downtown parking","No restaurants without reservations"]}),
/* ---- Italian / Pizza ---- */
R({name:"Rosie Cannonball", neighborhood:"Montrose", latitude:29.74, longitude:-95.391, cuisines:["Italian","Pizza"], foodTypes:["Italian","Pizza"], priceLevel:3, qualityScore:91, valueScore:79, groupScore:80, atmosphereTags:["Trendy","Lively","Date-night","Group-friendly"], dietaryTags:["Vegetarian options"], groupSizeMaximum:10, hasBar:true, description:"Wood-fired pizzas and pastas with serious wine energy.", bestFor:"Trendy group dinners that still center the food."}),
R({name:"Coltivare", neighborhood:"Heights", latitude:29.794, longitude:-95.402, cuisines:["Italian","Pizza"], foodTypes:["Italian","Pizza"], priceLevel:3, qualityScore:92, valueScore:80, groupScore:70, atmosphereTags:["Cozy","Date-night","Outdoor seating"], dietaryTags:["Vegetarian options"], groupSizeMaximum:6, isLocalFavorite:true, reservationAvailable:false, description:"Garden-to-table Italian with a beloved backyard patio.", bestFor:"Date nights willing to wait for a table.", dealBreakers:["No long waits","No restaurants without reservations"]}),
R({name:"Da Marco", neighborhood:"Montrose", latitude:29.741, longitude:-95.396, cuisines:["Italian"], foodTypes:["Italian"], priceLevel:4, qualityScore:93, valueScore:68, groupScore:64, atmosphereTags:["Date-night","Quiet enough to talk"], groupSizeMaximum:8, walkInFriendly:false, description:"White-tablecloth Italian that has anchored Houston fine dining for decades.", bestFor:"Anniversaries and closing dinners.", dealBreakers:["No extremely expensive restaurants","No formal dress code","No restaurants without reservations"]}),
R({name:"Pizaro's Pizza Napoletana", neighborhood:"Memorial", latitude:29.783, longitude:-95.51, cuisines:["Pizza","Italian"], foodTypes:["Pizza","Italian"], priceLevel:2, qualityScore:88, valueScore:88, groupScore:74, atmosphereTags:["Casual","Kid-friendly"], dietaryTags:["Vegetarian options","Gluten-conscious","Kid-friendly"], groupSizeMaximum:8, isHiddenGem:true, description:"Blistered Neapolitan pies from a serious wood oven.", bestFor:"Pizza purists who don't need a scene."}),
R({name:"Vinny's", neighborhood:"Midtown", latitude:29.746, longitude:-95.372, cuisines:["Pizza","Italian"], foodTypes:["Pizza","Italian"], priceLevel:1, qualityScore:85, valueScore:90, groupScore:82, atmosphereTags:["Casual","Late-night","Lively"], groupSizeMaximum:12, reservationAvailable:false, description:"Big slices, frozen drinks and late hours next to its sister bar.", bestFor:"Casual starts (or ends) to a night out.", dealBreakers:["No restaurants without reservations"]}),
/* ---- Thai / Vietnamese / Korean ---- */
R({name:"Street to Kitchen", neighborhood:"East End", latitude:29.742, longitude:-95.32, cuisines:["Thai"], foodTypes:["Thai"], priceLevel:2, qualityScore:94, valueScore:86, groupScore:62, atmosphereTags:["Casual","Unique or unusual","Cozy"], dietaryTags:["Vegetarian options"], groupSizeMaximum:6, isHiddenGem:true, isLocalFavorite:true, description:"Unapologetically hot, nationally praised Thai in a tiny room.", bestFor:"Small groups chasing the best plate in town.", dealBreakers:["No spicy food"]}),
R({name:"Kin Dee", neighborhood:"Heights", latitude:29.798, longitude:-95.4, cuisines:["Thai"], foodTypes:["Thai"], priceLevel:2, qualityScore:87, valueScore:82, groupScore:80, atmosphereTags:["Trendy","Group-friendly","Date-night"], dietaryTags:["Vegetarian options","Vegan options"], groupSizeMaximum:10, description:"Polished Thai with plenty of range for mixed spice tolerance.", bestFor:"Groups where half want mild, half want fire."}),
R({name:"Huynh", neighborhood:"EaDo", latitude:29.752, longitude:-95.35, cuisines:["Vietnamese"], foodTypes:["Vietnamese"], priceLevel:1, qualityScore:89, valueScore:93, groupScore:80, atmosphereTags:["Casual","Quiet enough to talk","Kid-friendly"], dietaryTags:["Vegetarian options","Kid-friendly"], groupSizeMaximum:10, isLocalFavorite:true, description:"Family-run Vietnamese beloved for spring rolls and bo luc lac.", bestFor:"Great food, easy logistics, gentle bill."}),
R({name:"Pho Binh Trailer", neighborhood:"South Houston", latitude:29.64, longitude:-95.23, cuisines:["Vietnamese"], foodTypes:["Vietnamese"], priceLevel:1, qualityScore:88, valueScore:95, groupScore:60, atmosphereTags:["Casual","Unique or unusual"], groupSizeMaximum:6, isHiddenGem:true, reservationAvailable:false, description:"The trailer that set Houston's pho standard.", bestFor:"A pilgrimage-worthy cheap bowl.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Xin Chào", neighborhood:"Montrose", latitude:29.745, longitude:-95.4, cuisines:["Vietnamese"], foodTypes:["Vietnamese"], priceLevel:3, qualityScore:90, valueScore:78, groupScore:82, atmosphereTags:["Trendy","Lively","Good cocktails","Group-friendly"], dietaryTags:["Vegetarian options"], groupSizeMaximum:12, hasBar:true, description:"Modern Viet-Texan plates with a lively bar program.", bestFor:"A dressed-up group night that stays fun."}),
R({name:"Bori", neighborhood:"Spring Branch", latitude:29.8, longitude:-95.53, cuisines:["Korean","Steak"], foodTypes:["Korean","Steak"], priceLevel:3, qualityScore:89, valueScore:77, groupScore:88, atmosphereTags:["Lively","Group-friendly"], groupSizeMaximum:14, description:"Premium Korean BBQ with tabletop grills built for groups.", bestFor:"Interactive group dinners — everyone cooks."}),
R({name:"Dak & Bop", neighborhood:"Museum District", latitude:29.725, longitude:-95.385, cuisines:["Korean"], foodTypes:["Korean"], priceLevel:2, qualityScore:85, valueScore:84, groupScore:78, atmosphereTags:["Casual","Lively","Late-night"], groupSizeMaximum:10, hasBar:true, description:"Korean fried chicken, beer and banchan.", bestFor:"Crispy, shareable, low-effort group food."}),
/* ---- Indian / Mediterranean ---- */
R({name:"Himalaya", neighborhood:"Mahatma Gandhi District", latitude:29.72, longitude:-95.51, cuisines:["Indian"], foodTypes:["Indian"], priceLevel:2, qualityScore:93, valueScore:90, groupScore:80, atmosphereTags:["Casual","Unique or unusual","Group-friendly"], dietaryTags:["Vegetarian options","Halal-friendly"], groupSizeMaximum:12, isLocalFavorite:true, description:"Indo-Pak icon; the chef's specials are Houston canon.", bestFor:"Food-first groups; ignore the strip-mall exterior."}),
R({name:"Musaafer", neighborhood:"Galleria", latitude:29.74, longitude:-95.465, cuisines:["Indian"], foodTypes:["Indian"], priceLevel:4, qualityScore:91, valueScore:66, groupScore:74, atmosphereTags:["Trendy","Date-night","Unique or unusual","Good cocktails"], dietaryTags:["Vegetarian options","Vegan options","Halal-friendly"], groupSizeMaximum:10, hasBar:true, walkInFriendly:false, description:"Opulent, design-forward regional Indian tasting plates.", bestFor:"A jaw-dropping room for big occasions.", dealBreakers:["No extremely expensive restaurants","No restaurants without reservations"]}),
R({name:"Pondicheri", neighborhood:"Upper Kirby", latitude:29.735, longitude:-95.42, cuisines:["Indian","Brunch"], foodTypes:["Indian","Brunch"], priceLevel:2, qualityScore:86, valueScore:82, groupScore:76, atmosphereTags:["Casual","Trendy","Kid-friendly"], dietaryTags:["Vegetarian options","Vegan options","Gluten-conscious","Kid-friendly"], groupSizeMaximum:10, description:"All-day Indian café — thali lunches to masala brunches.", bestFor:"Daytime groups with dietary ranges."}),
R({name:"Aladdin Mediterranean Grill", neighborhood:"Montrose", latitude:29.744, longitude:-95.392, cuisines:["Mediterranean"], foodTypes:["Mediterranean"], priceLevel:1, qualityScore:84, valueScore:92, groupScore:84, atmosphereTags:["Casual","Kid-friendly","Group-friendly"], dietaryTags:["Vegetarian options","Vegan options","Halal-friendly","Gluten-conscious","Kid-friendly"], groupSizeMaximum:14, reservationAvailable:false, description:"Counter-line Mediterranean where everyone finds a plate under $15.", bestFor:"Fast, healthy-ish, argument-proof group meals.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Craft Pita", neighborhood:"Briargrove", latitude:29.747, longitude:-95.485, cuisines:["Mediterranean"], foodTypes:["Mediterranean"], priceLevel:1, qualityScore:86, valueScore:90, groupScore:76, atmosphereTags:["Casual","Kid-friendly"], dietaryTags:["Vegetarian options","Vegan options","Gluten-conscious","Halal-friendly","Kid-friendly"], groupSizeMaximum:8, isHiddenGem:true, description:"Lebanese family recipes in a bright fast-casual room.", bestFor:"Quick quality when nobody wants to commit."}),
/* ---- Seafood / Steak / Burgers ---- */
R({name:"Goode Co. Seafood", neighborhood:"Upper Kirby", latitude:29.731, longitude:-95.425, cuisines:["Seafood","Cajun"], foodTypes:["Seafood","Cajun"], priceLevel:2, qualityScore:86, valueScore:81, groupScore:82, atmosphereTags:["Casual","Group-friendly","Kid-friendly"], dietaryTags:["Kid-friendly"], groupSizeMaximum:14, hasBar:true, description:"Gulf classics — campechana, mesquite-grilled fish — in a train-car dining room.", bestFor:"Reliable Gulf seafood for any age mix."}),
R({name:"Eugene's Gulf Coast Cuisine", neighborhood:"Montrose", latitude:29.743, longitude:-95.395, cuisines:["Seafood","Cajun","Southern"], foodTypes:["Seafood","Cajun","Southern"], priceLevel:3, qualityScore:87, valueScore:78, groupScore:80, atmosphereTags:["Lively","Group-friendly","Good cocktails"], groupSizeMaximum:12, hasBar:true, description:"Gumbo, oysters and Gulf Coast comfort with a proper bar.", bestFor:"Groups torn between seafood and Southern."}),
R({name:"Georgia James", neighborhood:"Regent Square", latitude:29.757, longitude:-95.405, cuisines:["Steak"], foodTypes:["Steak"], priceLevel:4, qualityScore:93, valueScore:70, groupScore:80, atmosphereTags:["Trendy","Date-night","Good cocktails","Group-friendly"], groupSizeMaximum:12, hasBar:true, walkInFriendly:false, description:"Cast-iron-seared steakhouse that swaps stuffiness for swagger.", bestFor:"Impressive but not stuffy — exactly that.", dealBreakers:["No extremely expensive restaurants","No restaurants without reservations"]}),
R({name:"Killen's Steakhouse", neighborhood:"Pearland", latitude:29.55, longitude:-95.28, cuisines:["Steak"], foodTypes:["Steak"], priceLevel:4, qualityScore:92, valueScore:72, groupScore:78, atmosphereTags:["Date-night","Group-friendly","Quiet enough to talk"], groupSizeMaximum:12, walkInFriendly:false, description:"Suburban temple of beef worth the drive south.", bestFor:"Steak obsessives with a designated driver.", dealBreakers:["No extremely expensive restaurants","No restaurants without reservations","No restaurant farther than the selected distance"]}),
R({name:"Burger Bodega", neighborhood:"Washington Ave", latitude:29.77, longitude:-95.41, cuisines:["Burgers"], foodTypes:["Burgers"], priceLevel:1, qualityScore:87, valueScore:88, groupScore:74, atmosphereTags:["Casual","Trendy","Late-night"], groupSizeMaximum:8, isNew:true, reservationAvailable:false, description:"Smash burgers with NYC-bodega styling and a cult line.", bestFor:"A fun, cheap night that still feels current.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Stanton's City Bites", neighborhood:"Sixth Ward", latitude:29.766, longitude:-95.383, cuisines:["Burgers"], foodTypes:["Burgers"], priceLevel:1, qualityScore:86, valueScore:91, groupScore:68, atmosphereTags:["Casual","Unique or unusual"], groupSizeMaximum:6, isHiddenGem:true, isLocalFavorite:true, reservationAvailable:false, description:"Old corner store flipping some of Houston's best burgers.", bestFor:"No-frills burger runs.", dealBreakers:["No restaurants without reservations"]}),
/* ---- Cocktail bars with food / Dessert / Brunch ---- */
R({name:"Anvil Bar & Refuge", neighborhood:"Montrose", latitude:29.743, longitude:-95.398, cuisines:["Cocktail bar with food"], foodTypes:["Cocktail bar with food"], priceLevel:2, qualityScore:90, valueScore:80, groupScore:72, atmosphereTags:["Lively","Trendy","Late-night","Date-night"], groupSizeMaximum:8, isLocalFavorite:true, hasBar:true, reservationAvailable:false, description:"The bar that built Houston's cocktail scene; snacks hold their own.", bestFor:"Drinks-first nights with real quality.", dealBreakers:["No restaurants without reservations","No loud clubs"]}),
R({name:"Nancy's Hustle", neighborhood:"EaDo", latitude:29.749, longitude:-95.348, cuisines:["Cocktail bar with food","Italian"], foodTypes:["Cocktail bar with food","Italian"], priceLevel:3, qualityScore:92, valueScore:79, groupScore:70, atmosphereTags:["Trendy","Lively","Date-night","Late-night"], dietaryTags:["Vegetarian options"], groupSizeMaximum:6, isLocalFavorite:true, hasBar:true, description:"Bistro-bar hybrid — Nancy cakes, natural wine, killer burger.", bestFor:"Cool-kid dinners without the attitude."}),
R({name:"Common Bond Bistro", neighborhood:"Montrose", latitude:29.742, longitude:-95.398, cuisines:["Brunch","Dessert"], foodTypes:["Brunch","Dessert"], priceLevel:2, qualityScore:84, valueScore:80, groupScore:80, atmosphereTags:["Casual","Kid-friendly","Outdoor seating"], dietaryTags:["Vegetarian options","Kid-friendly"], groupSizeMaximum:12, description:"Bakery-café with pastry cases that end arguments.", bestFor:"Brunch groups and dessert detours."}),
R({name:"Fat Cat Creamery", neighborhood:"Heights", latitude:29.803, longitude:-95.4, cuisines:["Dessert"], foodTypes:["Dessert"], priceLevel:1, qualityScore:87, valueScore:89, groupScore:70, atmosphereTags:["Casual","Kid-friendly"], dietaryTags:["Kid-friendly","Vegan options"], groupSizeMaximum:8, isLocalFavorite:true, reservationAvailable:false, description:"Small-batch Houston-made ice cream, local flavors.", bestFor:"The after-dinner decision nobody argues with.", dealBreakers:["No restaurants without reservations"]}),
/* ---- Round 2 additions — more Houston favorites (sample data) ---- */
R({name:"Kata Robata", neighborhood:"Upper Kirby", latitude:29.74, longitude:-95.418, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:3, qualityScore:93, valueScore:78, groupScore:74, atmosphereTags:["Trendy","Date-night","Sushi bar / counter","Good cocktails"], dietaryTags:["Gluten-conscious"], groupSizeMaximum:8, isLocalFavorite:true, hasBar:true, hasCounterSeating:true, description:"Longtime Houston sushi standard-bearer mixing pristine nigiri with playful robata plates.", bestFor:"When the sushi has to be great and nobody wants to gamble.", dealBreakers:["No raw fish"]}),
R({name:"Uchi", neighborhood:"Montrose", latitude:29.742, longitude:-95.398, cuisines:["Sushi","Japanese"], foodTypes:["Sushi","Japanese"], priceLevel:4, qualityScore:94, valueScore:70, groupScore:70, atmosphereTags:["Trendy","Date-night","Lively"], dietaryTags:["Gluten-conscious"], groupSizeMaximum:8, hasBar:true, walkInFriendly:false, description:"Austin-born, award-covered sushi house with inventive tastings and a buzzy room.", bestFor:"Celebration dinners that want a scene with the fish.", dealBreakers:["No raw fish","No extremely expensive restaurants","No restaurants without reservations"]}),
R({name:"Mala Sichuan Bistro", neighborhood:"Chinatown", latitude:29.704, longitude:-95.564, cuisines:["Chinese"], foodTypes:["Chinese"], priceLevel:2, qualityScore:91, valueScore:88, groupScore:82, atmosphereTags:["Casual","Lively","Group-friendly"], dietaryTags:["Vegetarian options"], groupSizeMaximum:12, isLocalFavorite:true, description:"Numbing-hot Sichuan classics that made half of Houston learn what mala means.", bestFor:"Groups that treat spice as a group activity.", dealBreakers:["No spicy food"]}),
R({name:"Tiger Den", neighborhood:"Chinatown", latitude:29.699, longitude:-95.567, cuisines:["Japanese"], foodTypes:["Japanese"], priceLevel:2, qualityScore:88, valueScore:86, groupScore:64, atmosphereTags:["Casual","Cozy","Late-night"], groupSizeMaximum:6, isHiddenGem:true, reservationAvailable:false, description:"Serious tonkotsu ramen in a snug Chinatown room.", bestFor:"Small groups on a noodle mission.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Blood Bros. BBQ", neighborhood:"Bellaire", latitude:29.705, longitude:-95.472, cuisines:["Barbecue"], foodTypes:["Barbecue"], priceLevel:2, qualityScore:94, valueScore:84, groupScore:78, atmosphereTags:["Casual","Unique or unusual","Group-friendly"], groupSizeMaximum:10, isLocalFavorite:true, reservationAvailable:false, description:"Asian-Texan smokehouse — brisket fried rice energy, pitmaster credentials.", bestFor:"BBQ people who think they've tried everything.", dealBreakers:["No long waits","No restaurants without reservations"]}),
R({name:"Feges BBQ", neighborhood:"Greenway Plaza", latitude:29.73, longitude:-95.44, cuisines:["Barbecue","Southern"], foodTypes:["Barbecue","Southern"], priceLevel:2, qualityScore:88, valueScore:86, groupScore:80, atmosphereTags:["Casual","Group-friendly"], dietaryTags:["Vegetarian options"], groupSizeMaximum:12, reservationAvailable:false, description:"Chef-driven barbecue where the vegetable sides get equal billing with the meats.", bestFor:"BBQ groups that include a vegetarian.", dealBreakers:["No restaurants without reservations"]}),
R({name:"El Tiempo Cantina", neighborhood:"Montrose", latitude:29.744, longitude:-95.39, cuisines:["Tex-Mex"], foodTypes:["Tex-Mex"], priceLevel:3, qualityScore:85, valueScore:72, groupScore:88, atmosphereTags:["Lively","Group-friendly","Sports-friendly"], dietaryTags:["Kid-friendly"], groupSizeMaximum:16, hasBar:true, description:"Loud, generous Tex-Mex from a storied fajita family; margaritas do heavy lifting.", bestFor:"Big-table birthday-style Tex-Mex nights.", dealBreakers:["No chains"]}),
R({name:"Teotihuacan Mexican Cafe", neighborhood:"East End", latitude:29.751, longitude:-95.338, cuisines:["Mexican","Tex-Mex"], foodTypes:["Mexican","Tex-Mex"], priceLevel:1, qualityScore:86, valueScore:93, groupScore:82, atmosphereTags:["Casual","Kid-friendly","Lively"], dietaryTags:["Kid-friendly"], groupSizeMaximum:12, isLocalFavorite:true, reservationAvailable:false, description:"Neighborhood Mexican cafe beloved for enormous plates and honest prices.", bestFor:"Feeding a crowd well without a bill debate.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Niko Niko's", neighborhood:"Montrose", latitude:29.744, longitude:-95.398, cuisines:["Mediterranean"], foodTypes:["Mediterranean"], priceLevel:1, qualityScore:84, valueScore:88, groupScore:80, atmosphereTags:["Casual","Kid-friendly","Outdoor seating"], dietaryTags:["Vegetarian options","Kid-friendly"], groupSizeMaximum:12, isLocalFavorite:true, reservationAvailable:false, description:"Montrose Greek institution — gyros, lemon potatoes, and a permanent line that moves fast.", bestFor:"Casual group refuel with zero planning.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Shri Balaji Bhavan", neighborhood:"Mahatma Gandhi District", latitude:29.72, longitude:-95.512, cuisines:["Indian"], foodTypes:["Indian"], priceLevel:1, qualityScore:88, valueScore:95, groupScore:72, atmosphereTags:["Casual","Unique or unusual"], dietaryTags:["Vegetarian options","Vegan options"], groupSizeMaximum:8, isHiddenGem:true, reservationAvailable:false, description:"South Indian vegetarian counter spot — dosas and chaat at pocket-change prices.", bestFor:"Adventurous cheap eats that overdeliver.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Brennan's of Houston", neighborhood:"Midtown", latitude:29.748, longitude:-95.373, cuisines:["Cajun","Southern"], foodTypes:["Cajun","Southern"], priceLevel:4, qualityScore:91, valueScore:70, groupScore:76, atmosphereTags:["Date-night","Quiet enough to talk"], groupSizeMaximum:10, hasBar:true, walkInFriendly:false, description:"Creole grande dame — turtle soup, bananas Foster, courtyard-anniversary energy.", bestFor:"Occasions that call for tablecloths.", dealBreakers:["No extremely expensive restaurants","No formal dress code","No restaurants without reservations"]}),
R({name:"State of Grace", neighborhood:"River Oaks", latitude:29.741, longitude:-95.437, cuisines:["Southern","Seafood"], foodTypes:["Southern","Seafood"], priceLevel:3, qualityScore:90, valueScore:75, groupScore:80, atmosphereTags:["Trendy","Date-night","Good cocktails","Group-friendly"], groupSizeMaximum:10, hasBar:true, description:"Handsome River Oaks room doing Gulf seafood, oysters and Southern comfort with polish.", bestFor:"Impressing parents and dates in one booking.", dealBreakers:[]}),
R({name:"Hubcap Grill", neighborhood:"Downtown", latitude:29.76, longitude:-95.362, cuisines:["Burgers"], foodTypes:["Burgers"], priceLevel:1, qualityScore:85, valueScore:90, groupScore:60, atmosphereTags:["Casual","Unique or unusual"], groupSizeMaximum:6, isLocalFavorite:true, reservationAvailable:false, description:"Tiny downtown burger shack with big, messy, opinionated burgers.", bestFor:"Lunch-counter burger runs, not lingering.", dealBreakers:["No restaurants without reservations"]}),
R({name:"Jang Guem Tofu & BBQ", neighborhood:"Spring Branch", latitude:29.802, longitude:-95.51, cuisines:["Korean"], foodTypes:["Korean"], priceLevel:1, qualityScore:86, valueScore:90, groupScore:78, atmosphereTags:["Casual","Group-friendly"], dietaryTags:["Vegetarian options"], groupSizeMaximum:10, isHiddenGem:true, description:"Bubbling soondubu stews and grilled plates in a no-frills Long Point strip mall.", bestFor:"Comfort-food nights when it's finally cold out.", dealBreakers:["No spicy food"]}),
R({name:"Asia Market Thai Lao Food", neighborhood:"Northside", latitude:29.794, longitude:-95.375, cuisines:["Thai"], foodTypes:["Thai"], priceLevel:1, qualityScore:89, valueScore:94, groupScore:58, atmosphereTags:["Casual","Unique or unusual"], groupSizeMaximum:6, isHiddenGem:true, reservationAvailable:false, description:"Thai-Lao kitchen tucked inside a grocery — som tum and larb with real heat.", bestFor:"Small groups chasing flavor over ambience.", dealBreakers:["No spicy food","No restaurants without reservations"]}),
R({name:"Hank's Ice Cream", neighborhood:"South Main", latitude:29.68, longitude:-95.43, cuisines:["Dessert"], foodTypes:["Dessert"], priceLevel:1, qualityScore:88, valueScore:92, groupScore:60, atmosphereTags:["Casual","Kid-friendly","Unique or unusual"], dietaryTags:["Kid-friendly"], groupSizeMaximum:6, isLocalFavorite:true, reservationAvailable:false, description:"Family-run scoop shop churning Houston-legend butter pecan since the '80s.", bestFor:"A worth-the-drive dessert finale.", dealBreakers:["No restaurants without reservations"]})
];

const DemoRestaurantProvider = {
  name:"demo",
  getRestaurants(city){
    // Demo cities: only Houston ships with data. Custom/imported
    // restaurants are merged in loadRestaurants().
    return HOUSTON_DEMO.filter(r => !city || r.city.toLowerCase() === city.toLowerCase() || city.trim()==="");
  }
};

/* Placeholder for a future live data source.
   INTEGRATION POINTS:
   1. Replace getRestaurants() with a fetch() to your restaurant/places
      API of choice, mapping the response into the restaurant object
      shape used above (see R() defaults for every supported field).
   2. Supply your own API key via your own backend or build step —
      never hard-code keys into a shared HTML file.
   3. Set ACTIVE_PROVIDER = LiveRestaurantProvider below.            */
const LiveRestaurantProvider = {
  name:"live",
  async getRestaurants(/* city, area, filters */){
    throw new Error("LiveRestaurantProvider is not configured. See integration notes in the source.");
  }
};
const ACTIVE_PROVIDER = DemoRestaurantProvider;

/* ============================================================
   STATE
   ============================================================ */
const LS_KEY = "dinnerDecider.v1";
const defaultState = () => ({
  step:1,
  config:{
    city:"Houston", area:"", zip:"", maxDistance:15, nearMe:null,
    cuisines:[], prices:[], atmosphere:[], dining:[], groupSize:4,
    mood:"", dealbreakers:[], avoidText:"",
    mode:"", players:4, vetoEnabled:true,
    minFinalists:3, allowWeighted:true, poolLimit:10, minQuality:0,
    sort:"match", title:"Dinner Decider"
  },
  removed:[], favorites:[], customRestaurants:[],
  round:{ status:"idle", eliminated:[], playersDone:[], winnerId:null, firstPickId:null, vetoUsed:false, decidedAt:null, poolIds:[] }
});
let state = defaultState();

function saveState(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch(e){ /* private mode / quota — app still works for this session */ }
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed==="object" && parsed.config){
      state = Object.assign(defaultState(), parsed);
      state.config = Object.assign(defaultState().config, parsed.config);
      state.round = Object.assign(defaultState().round, parsed.round||{});
    }
  }catch(e){ console.warn("Saved data unreadable — starting fresh.", e); }
}

/* All restaurants = demo provider + host-added, minus host-deleted */
function loadRestaurants(){
  const base = ACTIVE_PROVIDER.getRestaurants(state.config.city || "Houston");
  const deleted = new Set(state.customRestaurants.filter(c=>c._deleted).map(c=>c.id));
  const custom = state.customRestaurants.filter(c=>!c._deleted);
  const overridden = new Set(custom.map(c=>c.id));
  return base.filter(r=>!deleted.has(r.id) && !overridden.has(r.id)).concat(custom.map(c=>R(c)));
}

/* ============================================================
   SHARE LINKS — config encoded into the URL hash (no server)
   ============================================================ */
function b64uEncode(str){ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function b64uDecode(str){ return decodeURIComponent(escape(atob(str.replace(/-/g,"+").replace(/_/g,"/")))); }
function buildShareURL(){
  const c = state.config;
  const payload = {
    v:1,
    c:{ city:c.city, area:c.area, zip:c.zip, maxDistance:c.maxDistance,
        cuisines:c.cuisines, prices:c.prices, atmosphere:c.atmosphere, dining:c.dining,
        groupSize:c.groupSize, mood:c.mood, dealbreakers:c.dealbreakers, avoidText:c.avoidText,
        mode:c.mode, players:c.players, vetoEnabled:c.vetoEnabled,
        minFinalists:c.minFinalists, allowWeighted:c.allowWeighted, poolLimit:c.poolLimit,
        minQuality:c.minQuality, title:c.title },
    removed: state.removed,
    custom: state.customRestaurants.filter(x=>!x._deleted)
  };
  const base = location.href.split("#")[0];
  return base + "#g=" + b64uEncode(JSON.stringify(payload));
}
function tryLoadFromURL(){
  const m = location.hash.match(/#g=([A-Za-z0-9_\-]+)/);
  if(!m) return false;
  try{
    const payload = JSON.parse(b64uDecode(m[1]));
    if(!payload || payload.v!==1 || typeof payload.c!=="object") throw new Error("bad payload");
    state = defaultState();
    Object.keys(state.config).forEach(k=>{ if(k in payload.c) state.config[k]=payload.c[k]; });
    state.removed = Array.isArray(payload.removed)? payload.removed.filter(x=>typeof x==="string") : [];
    state.customRestaurants = Array.isArray(payload.custom)? payload.custom.filter(validRestaurant) : [];
    state.step = 5;
    saveState();
    toast("Game loaded from shared link — take your turn!");
    history.replaceState(null,"",location.pathname + location.search); // avoid re-import on refresh
    return true;
  }catch(e){
    console.warn("Invalid shared link ignored.", e);
    toast("That shared link couldn't be read — starting a fresh setup.");
    return false;
  }
}
function validRestaurant(o){
  return o && typeof o==="object" && typeof o.name==="string" && o.name.trim().length>0
    && (Array.isArray(o.cuisines) || Array.isArray(o.foodTypes));
}

/* ============================================================
   FILTERING + SCORING
   ============================================================ */
function haversineMiles(aLat,aLng,bLat,bLng){
  const toR = d=>d*Math.PI/180, R=3958.8;
  const dLat=toR(bLat-aLat), dLng=toR(bLng-aLng);
  const h = Math.sin(dLat/2)**2 + Math.cos(toR(aLat))*Math.cos(toR(bLat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function distanceFor(r){
  const c = state.config;
  if(c.nearMe && typeof c.nearMe.lat==="number"){
    return haversineMiles(c.nearMe.lat, c.nearMe.lng, r.latitude, r.longitude);
  }
  // No location permission: neutral estimate from city center (sample coords)
  return haversineMiles(29.7604, -95.3698, r.latitude, r.longitude);
}

function passesHardFilters(r){
  const c = state.config;
  // cuisine
  if(c.cuisines.length && !c.cuisines.includes("Anything")){
    if(!r.foodTypes.some(ft=>c.cuisines.includes(ft))) return false;
  }
  // price
  if(c.prices.length && !c.prices.includes(0) && !c.prices.includes(r.priceLevel)) return false;
  // group size
  if(c.groupSize < (r.groupSizeMinimum||1)) return false;
  if(c.groupSize > (r.groupSizeMaximum||8) + 2) return false; // clearly too big → removed
  // dietary & hard dining requirements
  const dietaryNeeds = ["Vegetarian options","Vegan options","Gluten-conscious","Halal-friendly","Kid-friendly"];
  for(const need of c.dining){
    if(dietaryNeeds.includes(need) && !(r.dietaryTags||[]).includes(need)) return false;
    if(need==="Reservations available" && !r.reservationAvailable) return false;
    if(need==="Walk-in friendly" && !r.walkInFriendly) return false;
    if(need==="Large-group friendly" && (r.groupSizeMaximum||8) < 10) return false;
  }
  // deal-breakers (restaurant declares which ones it trips)
  for(const db of c.dealbreakers){
    if((r.dealBreakers||[]).includes(db)) return false;
    if(db==="No extremely expensive restaurants" && r.priceLevel>=4) return false;
    if(db==="No raw fish" && r.foodTypes.includes("Sushi")) return false;
    if(db==="No restaurant farther than the selected distance" && distanceFor(r) > c.maxDistance) return false;
  }
  // distance is always a soft cap unless "Anywhere"
  if(c.maxDistance < 900 && distanceFor(r) > c.maxDistance * 1.6) return false;
  // quality threshold
  if(r.qualityScore < c.minQuality) return false;
  return true;
}

/* Transparent match estimate, 0–100. Quality-first, price-neutral. */
function scoreRestaurant(r){
  const c = state.config;
  const reasons = [];
  let s = 0;

  // Food quality + consistency (40%) — never boosted by price
  s += (r.qualityScore/100) * 40;
  if(r.qualityScore>=90) reasons.push("top-tier food quality");

  // Cuisine match (15%)
  if(!c.cuisines.length || c.cuisines.includes("Anything")){ s += 11; }
  else { const hits=r.foodTypes.filter(ft=>c.cuisines.includes(ft)).length; s += Math.min(15, 9+hits*3); reasons.push("your cuisine picks"); }

  // Atmosphere match (12%)
  const atmoWanted = c.atmosphere.filter(a=>a!=="No preference");
  if(!atmoWanted.length){ s += 9; }
  else{
    const hits = atmoWanted.filter(a=>(r.atmosphereTags||[]).includes(a) || (a==="Sushi bar / counter" && r.hasCounterSeating)).length;
    s += Math.min(12, (hits/atmoWanted.length)*12);
    if(hits) reasons.push("the vibe you asked for");
  }

  // Value for price (10%)
  s += (r.valueScore/100) * 10;
  if(r.valueScore>=88) reasons.push("great value");

  // Group suitability (10%)
  const fits = c.groupSize <= (r.groupSizeMaximum||8);
  s += fits ? (r.groupScore/100)*10 : 3;
  if(fits && c.groupSize>=6 && (r.groupSizeMaximum||8)>=c.groupSize) reasons.push("handles your group size");

  // Distance (8%)
  const d = distanceFor(r);
  s += Math.max(0, 8 - Math.min(8, d/ Math.max(2,c.maxDistance) * 8));
  if(d <= c.maxDistance*0.5) reasons.push("close by");

  // Local distinctiveness / newness / mood (5%)
  if(r.isLocalFavorite) s += 2;
  if(r.isHiddenGem) s += 1.5;
  if(r.isNew) s += 1.5;
  switch(c.mood){
    case "We want to try somewhere new": if(r.isNew){s+=4;reasons.push("it's new");} break;
    case "We want a hidden gem": if(r.isHiddenGem){s+=4;reasons.push("hidden-gem status");} break;
    case "We want something inexpensive": if(r.priceLevel<=1){s+=4;reasons.push("easy on the wallet");} if(r.priceLevel>=3)s-=4; break;
    case "We want drinks too": if(r.hasBar||(r.atmosphereTags||[]).includes("Good cocktails")){s+=4;reasons.push("real drinks");} break;
    case "We want a lively night out": if((r.atmosphereTags||[]).includes("Lively")){s+=3;reasons.push("lively room");} break;
    case "We care most about the food": s += (r.qualityScore-84)/4; break;
    case "We want somewhere impressive but not stuffy": if(r.qualityScore>=90 && !(r.dealBreakers||[]).includes("No formal dress code")){s+=3;reasons.push("impressive without the stiffness");} break;
    case "We want something easy": if(r.walkInFriendly){s+=3;reasons.push("zero-hassle logistics");} break;
  }
  if((c.dining||[]).length){
    const met = c.dining.filter(dd=>(r.dietaryTags||[]).includes(dd)).length;
    if(met) reasons.push("covers your dietary needs");
  }
  const pct = Math.max(35, Math.min(99, Math.round(s)));
  return { pct, reasons: reasons.slice(0,4) };
}

function scoredPool(){
  const all = loadRestaurants();
  const list = all.filter(passesHardFilters).map(r=>{
    const sc = scoreRestaurant(r);
    return Object.assign({}, r, { match: sc.pct, why: sc.reasons, dist: distanceFor(r) });
  });
  const c = state.config;
  const sorters = {
    match:(a,b)=>b.match-a.match,
    quality:(a,b)=>b.qualityScore-a.qualityScore,
    distance:(a,b)=>a.dist-b.dist,
    price:(a,b)=>a.priceLevel-b.priceLevel || b.match-a.match,
    newest:(a,b)=>(b.isNew?1:0)-(a.isNew?1:0) || b.match-a.match,
    group:(a,b)=>b.groupScore-a.groupScore
  };
  list.sort(sorters[c.sort]||sorters.match);
  return list.slice(0, c.poolLimit);
}
/* pool that's actually in play = scored pool minus host/guest removals */
function activePool(){ return scoredPool().filter(r=>!state.removed.includes(r.id)); }

/* ============================================================
   RENDERING — chips, steps, pool
   ============================================================ */
const STEPS = ["Where","Food","Vibe","Deal-breakers","The Game"];
function renderProgress(){
  const p = $('#progress'); p.innerHTML="";
  STEPS.forEach((name,i)=>{
    const n=i+1;
    const d=document.createElement('div');
    d.className="pstep"+(n===state.step?" active":n<state.step?" done":"");
    d.innerHTML = `<span class="dot">${n<state.step?"✓":n}</span><span>${name}</span>`;
    p.appendChild(d);
    if(n<STEPS.length){
      const bar=document.createElement('div');
      bar.className="pbar"+(n<state.step?" fill":"");
      bar.innerHTML="<i></i>";
      p.appendChild(bar);
    }
  });
}

function chipButton(label, pressed, cls=""){
  const b=document.createElement('button');
  b.type="button"; b.className="chip "+cls;
  b.setAttribute('aria-pressed', pressed?'true':'false');
  b.textContent=label;
  return b;
}
function renderToggleChips(containerSel, options, selectedArr, {single=false, onChange}={}){
  const box=$(containerSel); box.innerHTML="";
  options.forEach(opt=>{
    const label = typeof opt==="object"? opt.l : opt;
    const val = typeof opt==="object"? opt.v : opt;
    const b = chipButton(label, selectedArr.includes(val));
    b.addEventListener('click', ()=>{
      if(single){
        selectedArr.length=0; selectedArr.push(val);
      }else{
        const i=selectedArr.indexOf(val);
        if(i>=0) selectedArr.splice(i,1); else selectedArr.push(val);
      }
      saveState();
      renderToggleChips(containerSel, options, selectedArr, {single,onChange});
      if(onChange) onChange();
    });
    box.appendChild(b);
  });
}

function renderCuisines(filter=""){
  const box=$('#cuisineChips'); box.innerHTML="";
  const f=filter.trim().toLowerCase();
  CUISINES.filter(cz=>!f||cz.toLowerCase().includes(f)).forEach(cz=>{
    const b=chipButton(`${CUISINE_ICON[cz]||"🍽️"} ${cz}`, state.config.cuisines.includes(cz));
    b.addEventListener('click',()=>{
      const arr=state.config.cuisines, i=arr.indexOf(cz);
      if(cz==="Anything" && i<0) arr.length=0;
      if(i>=0) arr.splice(i,1); else arr.push(cz);
      if(cz!=="Anything"){ const ai=arr.indexOf("Anything"); if(ai>=0) arr.splice(ai,1); }
      saveState(); renderCuisines($('#cuisineSearch').value); renderCuisineSelected(); updateNextBtn();
    });
    box.appendChild(b);
  });
  if(!box.children.length) box.innerHTML = `<span class="hint">No cuisine matches "${esc(filter)}" — try another word.</span>`;
}
function renderCuisineSelected(){
  const box=$('#cuisineSelected'); box.innerHTML="";
  state.config.cuisines.forEach(cz=>{
    const b=chipButton(`${CUISINE_ICON[cz]||""} ${cz}`, true, "removable small");
    b.setAttribute('aria-label',`Remove ${cz}`);
    b.addEventListener('click',()=>{
      const arr=state.config.cuisines; arr.splice(arr.indexOf(cz),1);
      saveState(); renderCuisines($('#cuisineSearch').value); renderCuisineSelected(); updateNextBtn();
    });
    box.appendChild(b);
  });
}

function priceLabel(n){ return "$".repeat(n); }
function gradientFor(r){
  // deterministic gradient per restaurant, cuisine-tinted — no photos needed
  const hues={"Sushi":265,"Japanese":275,"Soup dumplings":18,"Chinese":10,"Korean":330,"Thai":135,"Vietnamese":160,"Italian":350,"Mexican":25,"Tex-Mex":35,"Indian":45,"Mediterranean":190,"Seafood":200,"Steak":355,"Burgers":30,"Pizza":15,"Barbecue":20,"Cajun":5,"Southern":40,"Brunch":50,"Dessert":310,"Cocktail bar with food":285};
  const h = hues[r.foodTypes[0]] ?? 260;
  let seed=0; for(const ch of r.id) seed=(seed*31+ch.charCodeAt(0))%360;
  return `linear-gradient(120deg, hsl(${h} 70% 22%), hsl(${(h+40+seed%40)%360} 80% 34%))`;
}

function renderPool(){
  const c=state.config;
  const pool = scoredPool();
  const q = ($('#poolSearch').value||"").trim().toLowerCase();
  const shown = pool.filter(r=>!q || r.name.toLowerCase().includes(q) || r.foodTypes.join(" ").toLowerCase().includes(q) || (r.neighborhood||"").toLowerCase().includes(q));
  const inPlay = activePool().length;

  $('#poolSummary').innerHTML =
    `<strong style="color:var(--text)">${inPlay}</strong> restaurant${inPlay===1?"":"s"} in play`
    + (state.removed.length? ` · ${state.removed.length} removed`:"")
    + ` · matched on cuisine, budget, group size of ${c.groupSize}, vibe and distance. Scores are helpful estimates, not exact science.`
    + (c.avoidText? `<br><span style="color:var(--warn)">Group note: “${esc(c.avoidText)}”</span>`:"");

  const cardsBox=$('#poolCards'); cardsBox.innerHTML="";
  $('#poolEmpty').hidden = pool.length>0;

  shown.forEach(r=>{
    const removed = state.removed.includes(r.id);
    const fav = state.favorites.includes(r.id);
    const fitsGroup = c.groupSize <= (r.groupSizeMaximum||8);
    const card=document.createElement('article');
    card.className="rcard"+(removed?" removed":"");
    card.innerHTML = `
      <div class="art" style="background:${gradientFor(r)}">
        <div class="tags-top">
          ${r.isNew?'<span class="tag tag-new">New</span>':""}
          ${r.isHiddenGem?'<span class="tag tag-gem">Hidden gem</span>':""}
          ${r.isLocalFavorite?'<span class="tag tag-fav">Local favorite</span>':""}
        </div>
        <span class="icon" aria-hidden="true">${CUISINE_ICON[r.foodTypes[0]]||"🍽️"}</span>
      </div>
      <div class="body">
        <h3><span>${esc(r.name)}</span><span class="match">${r.match}% match</span></h3>
        <p class="meta"><span>${esc(r.foodTypes.join(" · "))}</span> · <span>${esc(r.neighborhood||"")}</span> · <span class="price">${priceLabel(r.priceLevel)}</span> · <span>quality ${r.qualityScore}</span></p>
        <p class="desc">${esc(r.description)}</p>
        <p class="why">✨ ${r.match}% match because it fits ${esc(r.why.length? r.why.join(", ") : "your cuisine, budget, group size and distance preferences")}.</p>
        <p class="groupfit ${fitsGroup?"":"bad"}">${fitsGroup? `👥 Comfortable for your group of ${c.groupSize}` : `⚠️ Tight for ${c.groupSize} — best up to ${r.groupSizeMaximum}`}${r.hasCounterSeating?" · counter seating":""}${r.hasBar?" · full bar":""}</p>
        <div class="atms">${(r.atmosphereTags||[]).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join("")}</div>
        <div class="links">
          <a class="linkbtn" href="${esc(safeHref(r.website))}" target="_blank" rel="noopener">Website</a>
          <a class="linkbtn" href="${esc(safeHref(r.directionsUrl))}" target="_blank" rel="noopener">Directions</a>
          <a class="linkbtn" href="${esc(safeHref(r.menuUrl))}" target="_blank" rel="noopener">Menu</a>
        </div>
        <div class="actions">
          <button type="button" class="iconbtn ${fav?"on":""}" data-fav="${esc(r.id)}" aria-label="${fav?"Unfavorite":"Favorite"} ${esc(r.name)}" aria-pressed="${fav}">${fav?"♥":"♡"}</button>
          <button type="button" class="iconbtn" data-remove="${esc(r.id)}" aria-label="${removed?"Add back":"Remove"} ${esc(r.name)} ${removed?"to":"from"} the game">${removed?"↺":"✕"}</button>
        </div>
      </div>`;
    cardsBox.appendChild(card);
  });
  if(!shown.length && pool.length){
    cardsBox.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🔎</div><strong>Nothing in the pool matches that search</strong>Clear the search box to see all ${pool.length} options.</div>`;
  }

  // removed strip
  const removedInPool = pool.filter(r=>state.removed.includes(r.id));
  $('#removedWrap').hidden = !removedInPool.length;
  const rc=$('#removedChips'); rc.innerHTML="";
  removedInPool.forEach(r=>{
    const b=chipButton("↺ "+r.name, false, "small");
    b.addEventListener('click',()=>{ state.removed=state.removed.filter(x=>x!==r.id); saveState(); renderPool(); });
    rc.appendChild(b);
  });

  updateNextBtn();
}

/* delegated card actions */
$('#poolCards').addEventListener('click', e=>{
  const fav=e.target.closest('[data-fav]'), rem=e.target.closest('[data-remove]');
  if(fav){
    const id=fav.dataset.fav, i=state.favorites.indexOf(id);
    if(i>=0) state.favorites.splice(i,1); else state.favorites.push(id);
    saveState(); renderPool();
  }
  if(rem){
    const id=rem.dataset.remove;
    if(state.removed.includes(id)) state.removed=state.removed.filter(x=>x!==id);
    else state.removed.push(id);
    saveState(); renderPool();
  }
});

/* ============================================================
   STEP NAVIGATION
   ============================================================ */
function showScreen(id){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
}
function goStep(n){
  state.step=Math.max(1,Math.min(5,n)); saveState();
  showScreen('#screen-'+state.step);
  renderProgress(); updateNextBtn();
  if(state.step===5) renderPool();
  $('#hero').style.display = state.step===1 ? "" : "none";
  window.scrollTo({top:0, behavior: REDUCED?"auto":"smooth"});
  live("Step "+state.step+" of 5: "+STEPS[state.step-1]);
}
function updateNextBtn(){
  const b=$('#btnNext');
  $('#stickyCta').style.display = state.round.status==="done" ? "none" : "";
  if(state.step<5){
    b.textContent = state.step===4 ? "Build the restaurant pool →" : "Next →";
    b.disabled = (state.step===2 && state.config.cuisines.length===0);
    if(b.disabled) b.textContent = "Pick at least one cuisine (or “Anything”)";
  }else{
    const n = state.round.status==="eliminating" ? 0 : activePool().length;
    if(!state.config.mode){ b.textContent="Choose a game mode above"; b.disabled=true; }
    else if(n<2){ b.textContent="Need at least 2 restaurants in play"; b.disabled=true; }
    else{
      b.disabled=false;
      b.textContent = state.config.mode==="elim" ? `🤫 Start elimination (${state.config.players} players)` : "🎲 Let the game decide";
    }
  }
}
$('#btnNext').addEventListener('click',()=>{
  if(state.step<5){ syncStepInputs(); goStep(state.step+1); }
  else startGame();
});
$('#btnLoosen').addEventListener('click',()=>goStep(3));

function syncStepInputs(){
  const c=state.config;
  c.city=$('#fCity').value.trim()||"Houston";
  c.area=$('#fArea').value.trim();
  c.zip=$('#fZip').value.trim();
  c.maxDistance=parseInt($('#fDist').value,10)||15;
  c.avoidText=$('#fAvoid').value.trim();
  saveState();
}

/* ============================================================
   GAME MODES + START
   ============================================================ */
function renderModes(){
  $$('#modePick .mode').forEach(m=>{
    const on = m.dataset.mode===state.config.mode;
    m.setAttribute('aria-pressed', on?'true':'false');
    m.setAttribute('aria-checked', on?'true':'false');
    if(m.dataset.mode==="smart") m.style.display = state.config.allowWeighted? "":"none";
  });
  $('#playersField').hidden = state.config.mode!=="elim";
  $('#plVal').textContent = state.config.players;
  $('#vetoToggle').checked = state.config.vetoEnabled;
  updateNextBtn();
}
$('#modePick').addEventListener('click',e=>{
  const m=e.target.closest('.mode'); if(!m) return;
  state.config.mode=m.dataset.mode; saveState(); renderModes();
});
$('#vetoToggle').addEventListener('change',e=>{ state.config.vetoEnabled=e.target.checked; saveState(); });
$('#plMinus').addEventListener('click',()=>{ state.config.players=Math.max(2,state.config.players-1); saveState(); renderModes(); });
$('#plPlus').addEventListener('click',()=>{ state.config.players=Math.min(20,state.config.players+1); saveState(); renderModes(); });

let drawing=false; // guards double-click / double-tap / rapid re-entry
function startGame(){
  if(drawing || state.round.status==="done") return;
  syncStepInputs();
  const pool=activePool();
  if(pool.length<2){ toast("Add at least 2 restaurants back into the pool first."); return; }
  state.round.poolIds = pool.map(r=>r.id);
  if(state.config.mode==="elim"){ startElimination(pool); }
  else{ runDraw(pool); }
}

/* ---------- elimination ---------- */
let elim = null;
function startElimination(pool){
  state.round.status="eliminating"; state.round.eliminated=[]; state.round.playersDone=[]; saveState();
  elim = { pool, turn:0, current:null };
  updateNextBtn();
  showElimPass();
  $('#elimOverlay').classList.add('show');
}
function showElimPass(){
  const hand=$('#elimHand');
  const n=elim.turn+1, total=state.config.players;
  hand.innerHTML=`
    <div class="pass-screen">
      <div class="big" aria-hidden="true">📵➡️📱</div>
      <h2>Pass the phone — Player ${n} of ${total}</h2>
      <p class="sub" style="color:var(--muted)">Previous eliminations are hidden. No peeking, no takebacks.</p>
      <div class="field" style="max-width:320px;margin:18px auto">
        <label class="lbl" for="elimNick">Your nickname</label>
        <input class="input" id="elimNick" maxlength="20" placeholder="e.g. Taco Judge" autocomplete="off">
        <p class="hint" id="nickErr" style="color:var(--danger)"></p>
      </div>
      <button class="btn btn-primary" id="elimBegin" type="button">I'm ready — show me the pool</button>
      <div style="margin-top:14px"><button class="btn btn-ghost btn-sm" id="elimAbort" type="button">Cancel the round</button></div>
    </div>`;
  $('#elimBegin').addEventListener('click',()=>{
    const nick=$('#elimNick').value.trim();
    if(!nick){ $('#nickErr').textContent="Enter a nickname to take your turn."; return; }
    if(state.round.playersDone.some(p=>p.toLowerCase()===nick.toLowerCase())){
      $('#nickErr').textContent="That nickname already took a turn this round. One elimination per player!";
      return;
    }
    elim.current=nick; showElimBoard();
  });
  $('#elimAbort').addEventListener('click',abortElimination);
  $('#elimNick').focus();
}
function showElimBoard(){
  const hand=$('#elimHand');
  let picked=null;
  hand.innerHTML=`
    <h2>🤫 ${esc(elim.current)}, secretly eliminate one</h2>
    <p class="sub" style="color:var(--muted)">Tap the restaurant you never want to see tonight. Nobody will know it was you.</p>
    <div class="elim-list" id="elimList" role="listbox" aria-label="Restaurants — choose one to eliminate"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" id="elimSkip" type="button">Pass (eliminate nothing)</button>
      <button class="btn btn-primary btn-sm" id="elimConfirm" type="button" disabled>Confirm elimination</button>
    </div>`;
  const list=$('#elimList');
  elim.pool.forEach(r=>{
    const b=document.createElement('button');
    b.type="button"; b.className="elim-item"; b.setAttribute('role','option');
    b.setAttribute('aria-pressed','false');
    b.innerHTML=`<span><span class="nm">${CUISINE_ICON[r.foodTypes[0]]||"🍽️"} ${esc(r.name)}</span><br><span class="cz">${esc(r.foodTypes.join(" · "))} · ${esc(r.neighborhood||"")} · ${priceLabel(r.priceLevel)}</span></span><span aria-hidden="true">🗡️</span>`;
    b.addEventListener('click',()=>{
      picked = picked===r.id ? null : r.id;
      $$('.elim-item',list).forEach(x=>x.setAttribute('aria-pressed','false'));
      if(picked) b.setAttribute('aria-pressed','true');
      $('#elimConfirm').disabled=!picked;
    });
    list.appendChild(b);
  });
  $('#elimConfirm').addEventListener('click',()=>finishTurn(picked));
  $('#elimSkip').addEventListener('click',()=>finishTurn(null));
}
function finishTurn(pickedId){
  if(pickedId) state.round.eliminated.push(pickedId); // duplicates fine — hidden from later players
  state.round.playersDone.push(elim.current); saveState();
  elim.turn++;
  if(elim.turn < state.config.players){ showElimPass(); }
  else{
    // Protect at least minFinalists: randomly restore over-eliminated picks
    const uniq=[...new Set(state.round.eliminated)];
    let survivors = elim.pool.filter(r=>!uniq.includes(r.id));
    const minF = Math.min(state.config.minFinalists, elim.pool.length);
    while(survivors.length < minF && uniq.length){
      uniq.splice(rndInt(uniq.length),1);
      survivors = elim.pool.filter(r=>!uniq.includes(r.id));
      live("Protecting finalists — an eliminated restaurant was quietly restored.");
    }
    saveState();
    $('#elimOverlay').classList.remove('show');
    runDraw(survivors, true);
  }
}
function abortElimination(){
  state.round.status="idle"; state.round.eliminated=[]; state.round.playersDone=[]; saveState();
  elim=null; $('#elimOverlay').classList.remove('show'); updateNextBtn();
}

/* ============================================================
   THE DRAW — countdown, cycling, slowdown, confetti
   ============================================================ */
function pickWinner(pool){
  if(state.config.mode==="smart" && state.config.allowWeighted){
    // weighted, but floor keeps every option genuinely possible
    const weights = pool.map(r=>Math.max(6, Math.pow(r.match ?? 80, 1.6)/100));
    return pool[weightedPick(pool, weights)];
  }
  return pool[rndInt(pool.length)]; // Pure Fate + elimination survivors: exactly equal
}
function runDraw(pool, fromElim=false){
  if(drawing) return; drawing=true;
  const winner = pickWinner(pool);
  const ov=$('#drawOverlay'), cd=$('#cdNum'), cy=$('#cycler'), sub=$('#drawSub');
  ov.classList.add('show');
  sub.textContent = state.config.mode==="smart"
    ? "Smart Random: weighted odds, every option still alive…"
    : fromElim ? `${pool.length} survivors. Equal odds. No mercy.` : "Every restaurant has an exactly equal chance…";
  live("The game is deciding. Drumroll…");

  if(REDUCED){ // respect reduced motion: brief pause, straight to result
    cd.hidden=true; cy.hidden=false;
    cy.innerHTML=`<span>Deciding…</span>`;
    setTimeout(()=>{ ov.classList.remove('show'); lockResult(winner); }, 700);
    return;
  }
  // countdown 3-2-1
  cd.hidden=false; cy.hidden=true;
  let n=3; cd.textContent=n;
  const cdt=setInterval(()=>{
    n--;
    if(n>0){ cd.textContent=n; }
    else{
      clearInterval(cdt); cd.hidden=true; cy.hidden=false;
      cycle();
    }
  },700);

  function cycle(){
    let i=rndInt(pool.length), delay=70, elapsed=0;
    const totalMs=3600;
    (function tick(){
      const r=pool[i%pool.length]; i++;
      cy.innerHTML=`<span><span class="cicon" aria-hidden="true">${CUISINE_ICON[r.foodTypes[0]]||"🍽️"}</span>${esc(r.name)}</span>`;
      elapsed+=delay;
      if(elapsed<totalMs){
        delay=Math.round(70+Math.pow(elapsed/totalMs,2.4)*430); // suspenseful slowdown
        setTimeout(tick,delay);
      }else{
        cy.innerHTML=`<span><span class="cicon" aria-hidden="true">${CUISINE_ICON[winner.foodTypes[0]]||"🍽️"}</span>${esc(winner.name)}</span>`;
        cy.firstChild.classList.add('winner-wrap');
        confetti();
        setTimeout(()=>{ ov.classList.remove('show'); lockResult(winner); },1400);
      }
    })();
  }
}

function confetti(){
  if(REDUCED) return;
  const box=$('#confetti'); box.innerHTML="";
  const colors=["#a78bfa","#f472b6","#ff7a6b","#38bdf8","#fbbf24"];
  // Fewer particles on small / low-power screens to hold 60fps.
  const COUNT = Math.min(90, Math.max(40, Math.round(window.innerWidth / 5)));
  for(let i=0;i<COUNT;i++){
    const p=document.createElement('i');
    const sz=6+rndInt(8);
    p.style.cssText=`position:absolute;top:-4vh;left:${rndInt(100)}vw;width:${sz}px;height:${sz*0.5}px;background:${colors[rndInt(colors.length)]};border-radius:2px;opacity:.95;transform:rotate(${rndInt(360)}deg)`;
    const dur=2200+rndInt(1800), drift=(rndInt(200)-100);
    p.animate([
      {transform:`translate(0,0) rotate(0deg)`},
      {transform:`translate(${drift}px,105vh) rotate(${540+rndInt(540)}deg)`}
    ],{duration:dur,easing:"cubic-bezier(.2,.6,.4,1)",fill:"forwards"});
    box.appendChild(p);
  }
  setTimeout(()=>box.innerHTML="",4400);
}

/* ============================================================
   RESULT — lock, veto, share, new round
   ============================================================ */
function lockResult(winner){
  const isReroll = state.round.status==="done" && state.round.vetoUsed;
  if(!isReroll) state.round.firstPickId = state.round.firstPickId || winner.id;
  state.round.winnerId=winner.id;
  state.round.status="done";
  state.round.decidedAt=new Date().toISOString();
  saveState();
  drawing=false;
  renderResult();
  live(`Decision made: ${winner.name}. ${winner.foodTypes.join(", ")} in ${winner.neighborhood||state.config.city}.`);
}
function findById(id){ return loadRestaurants().map(r=>{const s=scoreRestaurant(r);return Object.assign({},r,{match:s.pct,why:s.reasons});}).find(r=>r.id===id); }

function renderResult(){
  const r=findById(state.round.winnerId);
  if(!r){ startNewRound(true); return; }
  showScreen('#screen-result'); renderProgress();
  $('#stickyCta').style.display="none";
  $('#resArt').style.background=gradientFor(r);
  $('#resArt').textContent=CUISINE_ICON[r.foodTypes[0]]||"🍽️";
  $('#resH').textContent=r.name;
  $('#resMeta').innerHTML=`<span>${esc(r.foodTypes.join(" · "))}</span> · <span>${esc(r.neighborhood||"")}</span> · <span class="price">${priceLabel(r.priceLevel)}</span>`;
  $('#resDesc').textContent=r.description;
  $('#resWhy').textContent=`✨ Why the group matched: ${r.why.length? r.why.join(", ") : "fits your cuisine, budget, group size and distance preferences"}.`;
  $('#resAddr').textContent="📍 "+r.address;
  const links=[["Directions",r.directionsUrl],["Menu",r.menuUrl],["Website",r.website]];
  if(r.phone) links.push(["Call","tel:"+r.phone]);
  if(r.reservationAvailable) links.push(["Reserve", gq(r.name+" reservations")]);
  $('#resLinks').innerHTML=links.map(([t,u])=>`<a class="linkbtn" style="font-size:.9rem;padding:12px 16px" href="${esc(safeHref(u))}" target="_blank" rel="noopener">${t}</a>`).join("");
  const when=new Date(state.round.decidedAt);
  $('#lockLine').innerHTML=`<span>🔒 Locked ${isNaN(when)?"":when.toLocaleString()}</span><span>${state.config.vetoEnabled? (state.round.vetoUsed?"🔥 Veto token: used — this result is final":"🎟️ Veto token: available") : "Veto disabled by host"}</span>`;
  $('#btnVeto').style.display = (state.config.vetoEnabled && !state.round.vetoUsed) ? "" : "none";
}

$('#btnVeto').addEventListener('click',()=>{
  if(state.round.vetoUsed || !state.config.vetoEnabled || drawing) return;
  const ok=confirm("Use the group's ONE veto token?\n\n• The current pick is permanently removed.\n• The next result is FINAL.\n• This cannot be undone.");
  if(!ok) return;
  state.round.vetoUsed=true;
  state.removed.push(state.round.winnerId); // original choice permanently out
  saveState();
  const pool=activePool().filter(r=>r.id!==state.round.winnerId);
  if(!pool.length){ toast("Nothing left to reroll into — the original pick stands."); state.removed=state.removed.filter(x=>x!==state.round.winnerId); saveState(); renderResult(); return; }
  runDraw(pool);
});

function shareText(){
  const r=findById(state.round.winnerId);
  return `🎲 The Dinner Decider has spoken: ${r.name} (${r.foodTypes.join(", ")} · ${r.neighborhood||state.config.city} · ${priceLabel(r.priceLevel)}). Tonight's decision has been made — no more group-chat negotiations. ${r.directionsUrl}`;
}
async function copyText(t,msg){
  try{ await navigator.clipboard.writeText(t); toast(msg); }
  catch(e){
    const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta);
    ta.select(); try{ document.execCommand('copy'); toast(msg);}catch(_){ toast("Copy failed — long-press to copy manually."); }
    ta.remove();
  }
}
$('#btnCopyResult').addEventListener('click',()=>copyText(shareText(),"Result copied — paste it in the group chat."));
$('#btnShareResult').addEventListener('click',()=>{
  if(navigator.share) navigator.share({title:"Dinner decided",text:shareText()}).catch(()=>{});
  else copyText(shareText(),"Sharing isn't available here — copied instead.");
});
$('#btnCopyLink').addEventListener('click',()=>{ syncStepInputs(); copyText(buildShareURL(),"Game link copied."); });
$('#btnCopyInvite').addEventListener('click',()=>{
  syncStepInputs();
  copyText(`🎲 Dinner Decider is ready. Nobody gets to argue with the result. Open the game and take your turn: ${buildShareURL()}`,"Invitation copied.");
});
if(navigator.share){
  $('#btnNativeShare').hidden=false;
  $('#btnNativeShare').addEventListener('click',()=>{
    syncStepInputs();
    navigator.share({title:"Dinner Decider",text:"Nobody has to pick. The game decides.",url:buildShareURL()}).catch(()=>{});
  });
}

function startNewRound(silent){
  if(!silent){
    const ok=confirm("Start a new round?\n\nThis clears tonight's locked result (the restaurant pool and preferences are kept).");
    if(!ok) return;
  }
  state.round=defaultState().round; saveState();
  drawing=false;
  goStep(5);
}
$('#btnNewRound').addEventListener('click',()=>startNewRound(false));

/* ============================================================
   HOST PANEL
   ============================================================ */
let editingId=null;
function renderHost(){
  const c=state.config;
  $('#hostTitle').value=c.title;
  $('#hostMinFinal').value=String(c.minFinalists);
  $('#hostWeighted').checked=c.allowWeighted;
  const all=loadRestaurants();
  $('#hostCount').textContent=all.length;
  const list=$('#hostList'); list.innerHTML="";
  all.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(r=>{
    const row=document.createElement('div'); row.className="host-item";
    row.innerHTML=`<span>${esc(r.name)} <span class="hint" style="margin:0">· ${esc(r.foodTypes.join(", "))} · ${priceLabel(r.priceLevel)}</span></span>
      <span style="display:flex;gap:6px">
        <button class="iconbtn" data-edit="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">✎</button>
        <button class="iconbtn" data-del="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">🗑</button>
      </span>`;
    list.appendChild(row);
  });
}
$('#hostTitle').addEventListener('input',e=>{
  state.config.title=e.target.value.trim()||"Dinner Decider";
  $('#appTitle').textContent=state.config.title; document.title=state.config.title+" — Nobody Has to Pick.";
  saveState();
});
$('#hostMinFinal').addEventListener('change',e=>{ state.config.minFinalists=parseInt(e.target.value,10)||3; saveState(); });
$('#hostWeighted').addEventListener('change',e=>{
  state.config.allowWeighted=e.target.checked;
  if(!e.target.checked && state.config.mode==="smart") state.config.mode="fate";
  saveState(); renderModes();
});
$('#hostList').addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]'), del=e.target.closest('[data-del]');
  if(del){
    const id=del.dataset.del, r=loadRestaurants().find(x=>x.id===id);
    if(r && confirm(`Remove "${r.name}" from the app's restaurant list?`)){
      // Always drop any existing (possibly host-edited) entry for this id first,
      // then add a fresh tombstone if it's a demo restaurant. Without the filter
      // here, a previously-edited demo restaurant's stale override entry would
      // survive alongside the tombstone and reappear in the pool (original bug).
      state.customRestaurants=state.customRestaurants.filter(x=>x.id!==id);
      if(HOUSTON_DEMO.some(h=>h.id===id)) state.customRestaurants.push({id, name:r.name, _deleted:true});
      saveState(); renderHost(); if(state.step===5) renderPool();
    }
  }
  if(ed){
    const r=loadRestaurants().find(x=>x.id===ed.dataset.edit); if(!r) return;
    editingId=r.id;
    $('#hostEditorTitle').textContent="Edit: "+r.name;
    $('#heName').value=r.name; $('#heHood').value=r.neighborhood||"";
    $('#heCuisines').value=r.foodTypes.join(", "); $('#hePrice').value=String(r.priceLevel);
    $('#heQuality').value=String(r.qualityScore); $('#heTags').value=(r.atmosphereTags||[]).join(", ");
    $('#heDesc').value=r.description||"";
    $('#hostEditor').hidden=false; $('#heName').focus();
  }
});
$('#btnHostAdd').addEventListener('click',()=>{
  editingId=null; $('#hostEditorTitle').textContent="Add a restaurant";
  ["#heName","#heHood","#heCuisines","#heTags","#heDesc"].forEach(s=>$(s).value="");
  $('#hePrice').value="2"; $('#heQuality').value="85";
  $('#hostEditor').hidden=false; $('#heName').focus();
});
$('#btnHostCancel').addEventListener('click',()=>{ $('#hostEditor').hidden=true; editingId=null; });
$('#btnHostSave').addEventListener('click',()=>{
  const name=$('#heName').value.trim();
  const cuisines=$('#heCuisines').value.split(",").map(s=>s.trim()).filter(Boolean);
  if(!name || !cuisines.length){ toast("A name and at least one cuisine are required."); return; }
  const obj={
    id: editingId || name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+"-"+Date.now().toString(36),
    name, neighborhood:$('#heHood').value.trim(),
    cuisines, foodTypes:cuisines,
    priceLevel:parseInt($('#hePrice').value,10)||2,
    qualityScore:Math.max(50,Math.min(100,parseInt($('#heQuality').value,10)||85)),
    atmosphereTags:$('#heTags').value.split(",").map(s=>s.trim()).filter(Boolean),
    description:$('#heDesc').value.trim()||"Host-added restaurant."
  };
  state.customRestaurants=state.customRestaurants.filter(x=>x.id!==obj.id);
  state.customRestaurants.push(obj);
  saveState(); $('#hostEditor').hidden=true; editingId=null;
  renderHost(); if(state.step===5) renderPool();
  toast(`Saved "${name}".`);
});
$('#btnExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(loadRestaurants(),null,2)],{type:"application/json"});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download="dinner-decider-restaurants.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
});
$('#btnImport').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const arr=JSON.parse(rd.result);
      if(!Array.isArray(arr)) throw new Error("Top level must be an array");
      const valid=arr.filter(validRestaurant);
      if(!valid.length) throw new Error("No valid restaurant objects found");
      valid.forEach(v=>{
        if(!v.id) v.id=v.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
        if(!v.foodTypes) v.foodTypes=v.cuisines||[];
        state.customRestaurants=state.customRestaurants.filter(x=>x.id!==v.id);
        state.customRestaurants.push(v);
      });
      saveState(); renderHost(); if(state.step===5) renderPool();
      toast(`Imported ${valid.length} restaurant${valid.length===1?"":"s"}.`+(valid.length<arr.length?` Skipped ${arr.length-valid.length} invalid entr${arr.length-valid.length===1?"y":"ies"}.`:""));
    }catch(err){ toast("Import failed: "+err.message); }
    e.target.value="";
  };
  rd.readAsText(f);
});
$('#btnRestore').addEventListener('click',()=>{
  if(!confirm("Restore the original Houston demo list? Host-added and edited restaurants will be removed.")) return;
  state.customRestaurants=[]; state.removed=[]; saveState();
  renderHost(); if(state.step===5) renderPool(); toast("Houston demo list restored.");
});
$('#btnClearData').addEventListener('click',()=>{
  if(!confirm("Clear ALL saved data — settings, pool edits, custom restaurants, and tonight's result?")) return;
  try{ localStorage.removeItem(LS_KEY); }catch(e){}
  state=defaultState(); drawing=false;
  initUI(); goStep(1); toast("All saved data cleared.");
});

/* ============================================================
   GEOLOCATION
   ============================================================ */
$('#btnNearMe').addEventListener('click',()=>{
  const st=$('#geoStatus');
  if(!navigator.geolocation){ st.textContent="Geolocation isn't available in this browser."; return; }
  st.textContent="Requesting your location…";
  navigator.geolocation.getCurrentPosition(
    pos=>{ state.config.nearMe={lat:pos.coords.latitude,lng:pos.coords.longitude}; saveState();
           st.textContent="✓ Location set — distances now measure from you."; toast("Location set."); },
    err=>{ st.textContent="Location permission was declined — distances use the city center instead. That's fine!"; },
    {timeout:8000, maximumAge:600000}
  );
});

/* ============================================================
   MOBILE: keep the sticky CTA above the iOS/Android on-screen
   keyboard when a text input is focused.
   ============================================================ */
function initKeyboardAvoidance(){
  if(!window.visualViewport) return;
  const vv = window.visualViewport;
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb-inset', (kb>60? kb:0) + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
}

/* ============================================================
   INIT
   ============================================================ */
function initUI(){
  const c=state.config;
  $('#fCity').value=c.city; $('#fArea').value=c.area; $('#fZip').value=c.zip;
  $('#fDist').value=String(c.maxDistance); $('#fAvoid').value=c.avoidText;
  $('#appTitle').textContent=c.title; document.title=c.title+" — Nobody Has to Pick. The Game Decides.";
  renderCuisines(); renderCuisineSelected();
  renderToggleChips('#priceChips', PRICES, c.prices, {onChange:()=>{ if(c.prices.includes(0)&&c.prices.length>1){c.prices.length=0;c.prices.push(0);saveState();renderToggleChips('#priceChips',PRICES,c.prices,{});} }});
  renderToggleChips('#atmoChips', ATMOS, c.atmosphere, {});
  renderToggleChips('#diningChips', DINING, c.dining, {});
  const moodArr=[c.mood].filter(Boolean);
  renderToggleChips('#moodChips', MOODS, moodArr, {single:true, onChange:()=>{ c.mood=moodArr[0]||""; saveState(); }});
  renderToggleChips('#dbChips', DEALBREAKERS, c.dealbreakers, {});
  $('#gsVal').textContent=c.groupSize>=20?"20+":c.groupSize;
  $('#poolSort').value=c.sort; $('#poolMin').value=String(c.minQuality); $('#poolLimit').value=String(c.poolLimit);
  renderModes(); renderHost(); renderProgress();
}
$('#gsMinus').addEventListener('click',()=>{ state.config.groupSize=Math.max(2,state.config.groupSize-1); $('#gsVal').textContent=state.config.groupSize; saveState(); });
$('#gsPlus').addEventListener('click',()=>{ state.config.groupSize=Math.min(20,state.config.groupSize+1); $('#gsVal').textContent=state.config.groupSize>=20?"20+":state.config.groupSize; saveState(); });
$('#cuisineSearch').addEventListener('input',e=>renderCuisines(e.target.value));
$('#poolSearch').addEventListener('input',()=>renderPool());
$('#poolSort').addEventListener('change',e=>{ state.config.sort=e.target.value; saveState(); renderPool(); });
$('#poolMin').addEventListener('change',e=>{ state.config.minQuality=parseInt(e.target.value,10)||0; saveState(); renderPool(); });
$('#poolLimit').addEventListener('change',e=>{ state.config.poolLimit=parseInt(e.target.value,10)||10; saveState(); renderPool(); });
["#fCity","#fArea","#fZip","#fDist","#fAvoid"].forEach(s=>$(s).addEventListener('change',syncStepInputs));

/* Register the service worker for offline support (PWA). */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW registration failed', err));
  });
}

/* Guard against back-button / refresh weirdness: state is re-read once. */
(function boot(){
  loadState();
  const fromLink = tryLoadFromURL();
  initUI();
  initKeyboardAvoidance();
  if(state.round.status==="done" && state.round.winnerId){
    renderResult();                       // refresh never erases a locked result
  }else{
    if(state.round.status==="eliminating"){ state.round.status="idle"; state.round.eliminated=[]; state.round.playersDone=[]; saveState(); }
    goStep(fromLink?5:state.step||1);
  }
})();
