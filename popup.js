// popup.js

// ─── CONFIG ─────────────────────────────────────────────────────────────────────
const apiKey = "AIzaSyC47XrOijQWBir0G0UtB-cjdGy7wwx-VwM";
const defaultSettings = {
  distance: 0.5,    // miles
  price: "2,3",     // Google Places min,max
};

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function milesToMeters(miles) {
  return miles * 1609.34;
}

function showProgress() {
  const bar = document.getElementById("api-progress");
  bar.style.display = "block";
  bar.value = 0;
}

function updateProgress(pct) {
  const bar = document.getElementById("api-progress");
  bar.value = pct;
}

function hideProgress() {
  const bar = document.getElementById("api-progress");
  setTimeout(() => (bar.style.display = "none"), 300);
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaultSettings, (s) => resolve(s));
  });
}

function renderHistory() {
  chrome.storage.sync.get({ history: [] }, ({ history }) => {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    history.forEach((item) => {
      const li = document.createElement("li");
      const ts = new Date(item.timestamp).toLocaleString();
      li.innerHTML = `<a href="${item.link}" target="_blank">${item.name}</a> <span>— ${ts}</span>`;
      list.appendChild(li);
    });
  });
}

function showHistory() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "none";
  document.getElementById("history-view").style.display = "block";
  renderHistory();
}

function hideHistory() {
  document.getElementById("history-view").style.display = "none";
  document.getElementById("main-view").style.display = "block";
}

function showSettings() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "block";
}

function hideSettings() {
  document.getElementById("settings-view").style.display = "none";
  document.getElementById("main-view").style.display = "block";
}

// ─── FETCH & RENDER ─────────────────────────────────────────────────────────────
async function fetchRestaurants() {
  try {
    showProgress();
    document.getElementById("loading-gif").style.display = "block";
    document.getElementById("wheel").style.display = "none";

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        updateProgress(20);
        const { latitude: lat, longitude: lng } = pos.coords;
        const { distance, price } = await loadSettings();

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
          + `?location=${lat},${lng}`
          + `&radius=${milesToMeters(distance)}`
          + `&type=restaurant&keyword=healthy`
          + `&minprice=${price[0]}&maxprice=${price[2]}`
          + `&key=${apiKey}`;

        updateProgress(40);
        const resp = await fetch(url);
        updateProgress(60);
        const data = await resp.json();
        updateProgress(80);

        if (!data.results?.length) {
          hideProgress();
          alert("No restaurants found! Try adjusting settings.");
          return;
        }

        // process & dedupe
        const seen = new Set();
        const restaurants = data.results
          .map((p) => ({
            name: p.name,
            googleMapsLink: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
          }))
          .filter((r) => {
            if (seen.has(r.name)) return false;
            seen.add(r.name);
            return true;
          });

        // wait your 2s “loading” for the wheel
        setTimeout(() => {
          document.getElementById("loading-gif").style.display = "none";
          document.getElementById("wheel").style.display = "block";
          updateWheel(restaurants);

          updateProgress(100);
          hideProgress();
        }, 2000);
      },
      (err) => {
        console.error(err);
        hideProgress();
        alert("Please enable location access.");
        document.getElementById("loading-gif").style.display = "none";
        document.getElementById("wheel").style.display = "block";
      }
    );
  } catch (e) {
    console.error(e);
    hideProgress();
    document.getElementById("loading-gif").style.display = "none";
    document.getElementById("wheel").style.display = "block";
  }
}

// ─── INIT ───────────────────────────────────────────────────────────────────────
(async function init() {
  // 1) Fetch & show
  await fetchRestaurants();

  // 2) Button hooks
  document.getElementById("spin").addEventListener("click", () => spin());
  document.getElementById("open-settings").addEventListener("click", showSettings);
  document.getElementById("close-settings").addEventListener("click", hideSettings);
  document.getElementById("open-history").addEventListener("click", showHistory);
  document.getElementById("close-history").addEventListener("click", hideHistory);
  document.getElementById("save-settings").addEventListener("click", async () => {
    const d = parseFloat(document.getElementById("distance").value);
    const p = document.getElementById("price").value;
    chrome.storage.sync.set({ distance: d, price: p }, async () => {
      swal({ title: "Settings saved!", icon: "success", button: false });
      hideSettings();
      await fetchRestaurants();
    });
  });

  // 3) Populate settings inputs
  const s = await loadSettings();
  document.getElementById("distance").value = s.distance;
  document.getElementById("price").value = s.price;
})();
