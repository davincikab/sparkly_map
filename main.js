// https://api.mapbox.com/styles/v1/nordkapper28/clhe1mjow015r01pg4bif3fsc.html?title=copy&access_token=pk.eyJ1Ijoibm9yZGthcHBlcjI4IiwiYSI6ImNqejlpMTdlejAwenkzZXM2dDF1bmxtdTMifQ.Q_XssY9aSttop553aF4zlQ&zoomwheel=true&fresh=true#16.62/47.130438/9.479522
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9yZGthcHBlcjI4IiwiYSI6ImNqejlpMTdlejAwenkzZXM2dDF1bmxtdTMifQ.Q_XssY9aSttop553aF4zlQ';
const map = new mapboxgl.Map({
    container: 'map',
    zoom: 10,
    center: [8.2399623, 47.0944236],
    projection:'mercator',
    // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
    style: 'mapbox://mapbox/nordkapper28/clhe1mjow015r01pg4bif3fsc'
});

map.addControl(new mapboxgl.NavigationControl({ showCompass:false}));
let geojsonData, logoLinks=[], isInitialLoad = true;
let geocodedPoint;

const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    placeholder:'Search for City / Zip Code',
    countries:'ch',
    types: 'country,region,place,postcode,locality,neighborhood',
    autocomplete:true
});
     
geocoder.addTo('#geocoder');

geocoder.on('result', ({ result }) => {
    console.log(result);

    // fly to map location
    map.flyTo({
        center:result.center,
        zoom:12
    });

    geocodedPoint = result.center;

    // sort the results
});

geocoder.on('clear', () => {
    geocodedPoint = undefined;
});

// popup
const popup = new mapboxgl.Popup();

map.on('load', () => {
    map.loadImage('pin.png', (error, image) => {
        if(error) throw error;

        map.addImage('map-pin', image);
    })
        
    // add a clustered GeoJSON source for a sample set of locations
    map.addSource('locations', {
        'type': 'geojson',
        'data': {"type":"FeatureCollection", "features":[]},
        'cluster': true,
        'clusterMinPoints':2,
        'clusterMaxZoom':14,
        'clusterRadius': 50,
    });

    // circle and symbol layers for rendering individual locations (unclustered points)
    map.addLayer({
        'id': 'store-location',
        'type': 'symbol',
        'source': 'locations',
        filter: ['!', ['has', 'point_count']],
        'layout':{
            'icon-image':'map-pin',
            'icon-size':0.55,
            'icon-allow-overlap':false
        },
        'paint': {}
    });

    map.on('click', 'store-location', (e) => {
        let feature = e.features[0];

        console.log(feature);
        renderPopup(feature);
    });

    map.on('mouseover', 'store-location', (e) => {
        map.getCanvas().style.cursor = "pointer";
    });
    map.on('mouseleave', 'store-location', (e) => {
        map.getCanvas().style.cursor = "";
    });

    fetchStoreLocation();

    // objects for caching and keeping track of HTML marker objects (for performance)
    const markers = {};
    let markersOnScreen = {};

    function updateMarkers() {
        const newMarkers = {};
        const features = map.querySourceFeatures('locations');
        const clusterSource = map.getSource('locations');

        if(!features.length && isInitialLoad) return;

        let mapPins = features.filter(feature => !feature.properties.cluster);
        let clusterPins = [];

        
        let clusters = features.filter(entry => entry.properties.cluster_id);

        
        // console.log("Cluster All: ", clusters);
        if(!clusters.length) {
            // console.log("Cluster Points: ", clusters.length);
            renderItemListing([...mapPins.map(ft => ft.properties)]);
        } else {
            clusters.forEach((ft, i) => {
                if(ft.properties.cluster_id) {
                    let { cluster_id, point_count } = ft.properties;

                    clusterSource.getClusterLeaves(cluster_id, point_count, 0, (error, featRes) => {
                        // Print cluster leaves in the console
                        clusterPins.push(...featRes);

                        if(i == clusters.length - 1) {
                            // console.log(clusterPins);
                            renderItemListing([...mapPins, ...clusterPins].map(ft => ft.properties), geocodedPoint);
                        }
                        
                    });
                } 
                
            });
        }


        

        // for every cluster on the screen, create an HTML marker for it (if we didn't yet),
        // and add it to the map if it's not there already
        for (const feature of features) {
            const coords = feature.geometry.coordinates;
            const props = feature.properties;
            if (!props.cluster) continue;
            const id = props.cluster_id;

            let marker = markers[id];
            if (!marker) {
                const el = createCustomIcon(props, coords);
                marker = markers[id] = new mapboxgl.Marker({
                    element: el
                }).setLngLat(coords);
            }
            newMarkers[id] = marker;

            if (!markersOnScreen[id]) marker.addTo(map);
        }
        // for every marker we've added previously, remove those that are no longer visible
        for (const id in markersOnScreen) {
            if (!newMarkers[id]) markersOnScreen[id].remove();
        }
        markersOnScreen = newMarkers;
    }

    // after the GeoJSON data is loaded, update markers on the screen on every frame
    map.on('render', () => {
        if (!map.isSourceLoaded('locations')) return;
        // updateMarkers();
    });
});

function fetchStoreLocation() {
    // Read vessel locations
    const sheetId = '1Dg-HDbs-4SssA4XzbxtM0FB-JDDy5_hA-CkLD3vNps0';
    const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?`;
    const sheetName = 'Verkaufsstellen';
    const query = encodeURIComponent('Select *')
    const url = `${base}&sheet=${sheetName}&tq=${query}`;

    fetch(url)
        .then(res => res.text())
        .then(rep => {
            //Remove additional text and extract only JSON:
            const jsonData = JSON.parse(rep.substring(47).slice(0, -2));
            console.log(jsonData);

            let cols = jsonData.table.cols.map(entry => entry.label ).filter(col => col);
            console.log(cols);

            let data = [];

            jsonData.table.rows.map(entry => {
                // console.log(entry.c);

                let entries = entry.c.map(item => {
                    if(item) {
                        return item.f ? item.f : item.v;
                    }

                    return item; 
                });

                // entries = entries.slice(0, cols.length);

                // console.log(entries);

                let obj = entries.reduce((a, b, i) => {
                    a = {...a, [cols[i]]:b};

                    return a;
                }, {});

                data.push(obj);
            });

            // get image logos
            logoLinks = data.filter(item => item['Logo']);
            console.log(logoLinks);

            updateModalImageLinks(logoLinks);

            // remove entries without coord
            data = data.filter(item => item.Latitude);
            let categories = data.map(a => a['Kategorie']).filter(ft => ft !== 'Online Shop');
            
            updateCategoryOptions([...new Set(categories)]);

            let geojsonFc = createGeoJson(data)
            geojsonData = JSON.parse(JSON.stringify(geojsonFc));

            map.getSource('locations').setData(geojsonFc);
            isInitialLoad = false;
            // renderItemListing(data);

        })
        .catch(console.error)
}

function updateModalImageLinks(links) {
    let linksElement = links.map(link => {
        return `<a class="card" href="${link['Website']}">
            <div class="link-btn">
                <i class="fa fa-up-right-from-square"></i>
            </div>

            <img src="${link['Logo']}" alt="" srcset="">
        </a>`;

    });

    document.getElementById("modal-content").innerHTML = linksElement.join("")
}

function updateCategoryOptions(categories) {
    // ['Retail', 'Online Shop', 'Bar / Club', 'Getränkemarkt']
    categories.map(category => {
        document.getElementById("store-type").innerHTML += `<option value="${category}">${category}</option>`
    });

    
}
function renderItemListing(data, point) {
    // let features = map.queryRenderedFeatures({ layers:['store-location']});
    // console.log(features);
    // update the title
    let uniqueFeatures = data.reduce((a, b) => {
        let ft = a.find(d => d.Name == b.Name && d['Full Address'] == b['Full Address']);

        if(!ft) {
            a.push(b);
        }

        return a;
    }, []);

    document.querySelector(".listing-header").innerHTML = `${uniqueFeatures.length} LOCATIONS FOUND`;

    if(uniqueFeatures.length == 0) {
        renderListingTemplate();
        return;
    }

    data = addDistanceToPoints(uniqueFeatures, point);
    // console.log(data)    

    // render listing items
    let items = data.map(item => {
        return  `<div class="listing-item d-flex" data-name="${item.Name}" data-address="${item['Strasse']}">
            <img src="pin.png" alt="" height="20px">

            <div class="details-section">
                <div class="title">${item.Name}</div>
                <div class="address">
                    <div class="address-street">
                        ${item['Strasse']}
                    </div> 
                    <div class="d-flex address-zip">
                        <div>${item['PLZ']}</div>
                        <div>${item['Ort']}</div>
                        <div>${item['Land']}</div>	
                    </div>
                </div>
            </div>

            <div class="direction">
                <i class="fa fa-angle-right"></i>
            </div>
        </div>`
    });

    document.querySelector(".listing-body").innerHTML = items.join("");
    fireListingListeners();
}

function renderListingTemplate() {
    let logos = logoLinks.map(link => {
        return ` <a class="card-item d-flex" href="${link.Website}">
            <img src="${link.Logo}" alt="" srcset="">
            
            <div class="link-btn">
                <i class="fa fa-up-right-from-square"></i>
            </div>
        </a>`;

    });

    document.querySelector(".listing-body").innerHTML = `<div class="listing-container">
        <div class="header">
            <div class="image-top">
                <img src="pin.png" alt="png" height="50px">
            </div>
        </div>
        

        <div class="content">
            <div class="">
                No store found.
            </div>

            <div class="description">
                Unfortunately, we have not found 
                any store locations near this address.
                Our products are also available at various
                online retailers. 
            </div>

            <div class="retailer-btn d-none" id="online-retailer-btn">
                Explore online retailers
            </div>

            <div class="card-list">
                ${logos.join("")}
            </div>
        </div>
    </div>`;
}

function addDistanceToPoints(entries, point) {
    if(point) {
        entries = entries.map(entry => {
            let point1 = turf.point(point);
            let point2 = turf.point([entry.Longitude, entry.Latitude]);

            entry.distance = turf.distance(point1, point2);

            return entry;
        });

        entries.sort((a, b) => a.distance - b.distance);
    } 

    return entries;
}

function fireListingListeners() {
    document.querySelectorAll(".listing-item").forEach(item => {
        item.onclick = (e) => {
            let { dataset : { name, address}} = e.target;
            let feature = getFeature(name, address);

            if(feature) {
                renderPopup(feature);
                map.flyTo({
                    center:[...feature.geometry.coordinates],
                    zoom:12
                })
            }
            
        }

    });
}

function getFeature(name, street) {
    console.log(name, street);

    let feature = geojsonData.features.find(feature => feature.properties.Name == name && feature.properties['Strasse'] == street);
    console.log(feature);

    return feature;
}

function renderPopup(feature) {
    let item = feature.properties;

    let content = `<div class="popup-content">
        <div class="details-section">
            <div class="title">${feature.properties.Name}</div>

            <div class="address">
                <div class="address-street">
                    ${item['Strasse']}
                </div> 
                <div class="d-flex address-zip">
                    <div>${item['PLZ']}</div>
                    <div>${item['Ort']}</div>
                    <div>${item['Land']}</div>	
                </div>
            </div>
        </div>

        <a 
            class="direction-button" 
            href="https://www.google.com/maps/dir//${item['Full Address']}"
        >
            Get Directions
        </a>

    </div>`;

    popup
        .setLngLat([...feature.geometry.coordinates])
        .setHTML(content)
        .addTo(map);
}

function createGeoJson(data) {
    let fc = {"type":"FeatureCollection", "features":[]};

    fc.features = data.filter(item => item.Latitude).map(item => {
        let feature = {
            "type":"Feature",
            "geometry":{
                "type":"Point",
                "coordinates":[parseFloat(item.Longitude), parseFloat(item.Latitude)]
            },
            "properties":{...item}
        }
    
        return feature
    });

    console.log(fc);
    return fc;
}

function zoomToCluster(e, id) {
    let { coord } = e.target.dataset;

    var clusterId = parseInt(id);
    map.getSource('locations').getClusterExpansionZoom(
        clusterId,
        function(err, zoom) {
            console.log(zoom);

            if (err) return;
            
            map.easeTo({
                center: eval(coord),
                zoom: zoom+0.3
            });
        }
    );
}

function createCustomIcon(props, coord) {
    let element = document.createElement('div');

    element.classList.add('custom-cluster');
    element.setAttribute('id', props.cluster_id);
    element.setAttribute('data-coord', "["+coord+"]");

    element.style.width = element.style.height = "56px";

    // calculate the fonts and border width
    element.style.fontSize = getFontSize(props.point_count) + "em";
    element.style.borderWidth =  getBorderWidth(props.point_count) + "px";

    function getSize(pointCount) {
        if(pointCount < 20) {
            return 25;
        }
        return 25 + pointCount/40 * 0.5;
    }

    function getFontSize(pointCount) {
        return pointCount < 30 ? 0.75 : pointCount < 50 ? 0.85 : 1;
    }

    function getBorderWidth(pointCount) {
        return pointCount < 20 ? 5 : pointCount < 50 ? 6 : 7;
    }

    element.innerHTML += `<div class="cluster_inner">
        <div class="text-section">
            ${convertCount(props.point_count, 1)}
        </div>
    </div>`;

    // add event listener
    element.addEventListener('click' , function(e) {
        console.log(e);

        zoomToCluster(e, e.target.id);
    });

    return element;
}

function convertCount(n,d){
    x=(''+n).length,p=Math.pow,d=p(10,d);
    x-=x%3;

    return Math.round(n*d/p(10,x))/d+" kMGTPE"[x/3]
}


// category filter
document.getElementById("store-type").onchange = (e) => {
    let { value } = e.target;
    let data = JSON.parse(JSON.stringify(geojsonData));
    let features;

    if(value) {
        features = filterDataByCategory(value);
    } else {
        features = data.features
    }

    map.getSource('locations').setData({
        "type":"featureCollection",
        "features":[...features]
    });
    
}

function filterDataByCategory(category) {
    return geojsonData.features.filter(feature => feature.properties['Kategorie'] == category);
}
// toggle tab
let activeViewElement = document.querySelector(".view-btn.active");
document.querySelectorAll(".view-btn").forEach(viewBtn => {
    viewBtn.onclick = (e) => {
        console.log(e);

        let { dataset: {target } } = e.target;

        if(activeViewElement != e.target) {
            activeViewElement.classList.remove("active");

            e.target.classList.add("active");
            activeViewElement = e.target;
        }
        
        if(target == 'map') {
            document.getElementById("map").style.display = "block";
            document.querySelector(".item-listing").style.display = "none";
        } else {
            document.getElementById("map").style.display = "none";
            document.querySelector(".item-listing").style.display = "block";
        }
    }

});


// open toggle modal container
let modalContainer = document.querySelector(".modal-container");
let closeBtn = document.getElementById("modal-close-btn");
let openModalContainerBtns = document.querySelectorAll(".retailer-btn");

closeBtn.onclick = (e) => {
    modalContainer.classList.add("d-none");
}

openModalContainerBtns.forEach(btn => {
    btn.onclick = (e) => {
        modalContainer.classList.remove("d-none");
    }
});