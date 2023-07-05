/**
 * Main JS file for the browser action popup menu.  Gathers and saves data, as well as prepopulates the menus.
 */
var DATA_PROPS = ['enabled', 'messagingEnabled', 'hideThumbs', 'removeBanner', 
					'blocklistArtists', 'blocklistKeywords', 'allowlistArtists', 'ratings'];

// Helper functions
function matches(el, selector) {
	if (!selector) return false;
	return (el.matches || el.matchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector).call(el, selector);
}

function getEl(selector) {
	const list = document.querySelectorAll(selector);
	return list.length < 2 ? list[0]:list;
}

function sendMessage(message) {
	chrome.runtime.sendMessage(message, (resp) => {
		if (resp) console.log(resp);
	});
}

function gatherSaveData() {
	var data = {};
	var i = null;

	// Blocklist artists
	var blocklistArtists = getEl('#artist-names').value.trim().toLowerCase().split('\n');
	i = blocklistArtists.length - 1;

	while (i >= 0) {
		blocklistArtists[i] = blocklistArtists[i].trim();
		i--;
	}
	data.blocklistArtists = !blocklistArtists[0] ? []:blocklistArtists;

	// Blocklist keywords
	var blocklistKeywords = getEl('#filter-descriptions').value.trim().split('\n');
	i = blocklistKeywords.length - 1;

	while (i >= 0) {
		blocklistKeywords[i] = blocklistKeywords[i].trim();
		i--;
	}
	data.blocklistKeywords = !blocklistKeywords[0] ? []:blocklistKeywords;

	//Allowlist artists
	var allowlistArtists = getEl('#artist-allowlist').value.trim().toLowerCase().split('\n');
	i = allowlistArtists.length - 1;

	while (i >= 0) {
		allowlistArtists[i] = allowlistArtists[i].trim();
		i--;
	}
	data.allowlistArtists = !allowlistArtists[0] ? []:allowlistArtists;

	//Rating settings
	data.ratings = [];

	getEl('.fa-rating').forEach((opt) => {
		if (opt.checked) data.ratings.push(opt.value); 
	});

	//Enable extension
	data.enabled = getEl('#faEnabled').checked

	//Enable messaging
	data.messagingEnabled = getEl('#faMessaging').checked

	//Only hide thumbnails
	data.hideThumbs = getEl('#faHideThumbs').checked

	//Remove banner
	data.removeBanner = getEl('#faRemoveBanner').checked

	return data;
}

function clearOptions() {
	//Reset Options
	getEl('#artist-names, #artist-allowlist, #filter-descriptions').forEach(div => div.value = '');

	getEl('#faEnabled, #faMessaging, .fa-rating').forEach(opt => opt.checked = true);

	getEl('#faHideThumbs, #faRemoveBanner').forEach(opt => opt.checked = true);

	var data = gatherSaveData();

	getEl('#json-data').value = JSON.stringify( data );

	sendMessage({ 'type': 'clear', 'data': data });
}

function verifyJSON( data ) {
	var hasAllProperties = true;
	for( var i = 0; i < DATA_PROPS.length; i++ ) {
		hasAllProperties = data.hasOwnProperty( DATA_PROPS[i] );
		if( !hasAllProperties ) break;
	}

	if( !hasAllProperties ) {
		return sendMessage({ 'type': 'message', 'data': { 'text': 'Invalid JSON data, data not loaded' } });
	}

	//Send message to save data
	sendMessage({ 'type': 'save', 'data': data });

	prepopulate( data );
}

function prepopulate( data ) {
	//Check for values, set defaults
	data = data || {};

	data.blocklistArtists = data.blocklistArtists || [];
	data.allowlistArtists = data.allowlistArtists || [];
	data.blocklistKeywords = data.blocklistKeywords || [];

	if( !data.ratings ) {
		data.ratings = [];
		getEl('.fa-rating').forEach(opt => data.ratings.push(opt.value));
	}

	if(!data.hasOwnProperty('enabled')) {
		data.enabled = true;
		data.messagingEnabled = true;
	}

	//Prepopulate fields
	getEl('#artist-names').value = data.blocklistArtists.join('\n');
	getEl('#artist-allowlist').value = data.allowlistArtists.join('\n');
	getEl('#filter-descriptions').value = data.blocklistKeywords.join('\n');

	getEl('.fa-rating').forEach(opt => opt.checked = data.ratings.includes(opt.value));

	getEl('#faEnabled').checked = !!data.enabled;

	getEl('#faMessaging').checked = !!data.messagingEnabled;

	getEl('#faHideThumbs').checked = !!data.hideThumbs;

	getEl('#faRemoveBanner').checked = !!data.removeBanner;

	//Check for storage ability
	getEl('.sync-settings').forEach(div => div.classList.toggle('hide', !chrome.storage.sync));

	getEl('#json-data').value = JSON.stringify(data);
}

function bindEvents() {
	getEl('.tab-container').addEventListener('click', (e) => {
		const el = e.target;
		if (el.classList.contains('active') || !el.classList.contains('tab')) return;
		getEl('.tab, .tab-content').forEach(div => div.classList.remove('active'));
		el.classList.add('active');
		const link = el.dataset['tabContent'];
		getEl('.tab-content.' + link).classList.add('active');
	});

	getEl('#save-options').addEventListener('click', () => {
		var data = gatherSaveData();

		getEl('#json-data').value = JSON.stringify(data);

		//Send message to save data
		sendMessage({ 'type': 'save', 'data': data });
	});

	getEl('#clear-options').addEventListener('click', () => clearOptions());

	//Sync settings
	getEl('#sync-upload').addEventListener('click', () => {
		chrome.storage.sync.set(gatherSaveData(), function() {
			sendMessage( { 'type': 'message', 'data': { 'text': 'Data uploaded to cloud' } } );
		});
	});

	getEl('#sync-download').addEventListener('click', () => {
		chrome.storage.sync.get(null, function( data ) {
			if (!data.hasOwnProperty ('enabled')) {
				return sendMessage({ 'type': 'message', 'data': { 'text': 'No data stored in cloud' } });
			}

			prepopulate( data );

			chrome.storage.local.clear(function() {
				chrome.storage.local.set(data, function() {
					sendMessage({ 'type': 'message', 'data': { 'text': 'Data downloaded from cloud, settings overridden' } });
				});
			});
		});
	});

	getEl('#sync-clear').addEventListener('click', () => {
		chrome.storage.sync.clear(function() {
			sendMessage({ 'type': 'message', 'data': { 'text': 'Cloud data cleared' } });
		});
	});

	//JSON Data
	getEl('#json-data').addEventListener('focus', e => e.target.select());

	getEl('#load-json-data').addEventListener('click', () => {
		var jsonData = getEl('#json-data').value;
		var data = null;
		try {
			data = JSON.parse(jsonData);
		} catch ( e ) {
			return sendMessage({ 'type': 'message', 'data': { 'text': 'Invalid JSON data, data not loaded' } });
		}

		verifyJSON(data);
	});
}

function init() {
	//Load data from storage
	chrome.storage.local.get(null, function(data) {
		prepopulate(data);
	});

	bindEvents();
}

init();
