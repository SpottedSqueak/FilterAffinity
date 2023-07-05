/**
 * Background script for the Filter Affinity plugin.  Handles data saving and messaging from throughout the plugin.
 */

chrome.runtime.onMessage.addListener( sortRequest );
const storage = chrome.storage.local;

function initData() {
	const data = {
		enabled: true,
		messagingEnabled: true,
		hideThumbs: false,
		removeBanner: false,
		blocklistArtists: [],
		blocklistKeywords: [],
		allowlistArtists: [],
		ratings: [ 'r-general', 'r-mature', 'r-adult' ],
		versionFixed: 154,
	}

	storage.set( data, function() {} );
}

// Replace old, racist terminology with more clear names
function fixData(data) {
	// No need to do this if it's already fixed
	if (data.blacklistArtists) {
		data.blocklistArtists = data.blacklistArtists;
		data.allowlistArtists = data.whitelistArtists;
		data.blocklistKeywords = data.blacklistKeywords;
		delete data.blacklistArtists;
		delete data.whitelistArtists;
		delete data.blacklistKeywords;
		clear(data);
	}
	if (!data.versionFixed) data.versionFixed = 0;
	if (data.versionFixed < 155) {
		// Fix inconsistent values
		data.blocklistArtists = data.blocklistArtists.map(name => name.toLowerCase());
		data.allowlistArtists = data.allowlistArtists.map(name => name.toLowerCase());
		data.versionFixed = 155;
		save(data);
	}
}

function runFilter( data ) {
	chrome.tabs.query( { url: '*://*.furaffinity.net/*', active: true }, function( tabs ) {
		if( tabs.length < 1 ) return;
		for( let i = 0; i < tabs.length; i++ ) {
	    	chrome.tabs.sendMessage( tabs[ i ].id, { action: 'filter', data }, (error) => {
					if (chrome.runtime.lastError) console.log(chrome.runtime.lastError);
				});
	    }
	});
}

function getData() {
	storage.get( null, function( data ) {
		if( !data.hasOwnProperty( 'enabled' ) ) initData();
		else {
			fixData( data );
			runFilter( data );
		}
	});
}

function save( data ) {
	runFilter( data );
	return storage.set( data, function() {
		if( data.messagingEnabled ) notify( { 'text': 'Data saved' } );
	});
}

function clear( data ) {
	runFilter( data );
	return storage.clear( function() {
		storage.set( data, function() {
			if( data.messagingEnabled ) notify( { 'text': 'Data cleared' } );
		});
	});
}

function saveToCloud( data ) {
	chrome.storage.sync.set( data, function() {
		if( data.messagingEnabled ) notify( { 'text': 'Data synced to cloud' } );
	});
}

function loadFromCloud() {
	chrome.storage.sync.get( null, function( data ) {
		if( data.messagingEnabled ) notify( { 'text': 'Data loaded from cloud' } );

		chrome.storage.local.set( data, function() {});

		runFilter( data );
	});
}

function addArtist( name ) {
	const artist = name.toLowerCase();
	storage.get( null, function( data ) {
		const artists = data.blocklistArtists || [];

		if( artists.indexOf( artist ) < 0 ) {
			artists.push( artist );
		} else {
			return;
		}

		data.blocklistArtists = artists;

		storage.set( { 'blocklistArtists': artists }, function() {
			if( data.messagingEnabled ) notify( { text: 'Artist: ' + artist + ' has been filtered' } );
		});

		runFilter( data );
	});
}

function removeArtist( name ) {
	const artist = name.toLowerCase();
	storage.get( null, function( data ) {
		const artists = data.blocklistArtists || [];
		const index = artists.indexOf( artist );

		if( index > -1 ) {
			artists.splice( index, 1 );
		} else {
			return;
		}

		data.blocklistArtists = artists;

		storage.set( { 'blocklistArtists': artists }, function() {
			if( data.messagingEnabled ) notify( { text: 'Artist: ' + artist + ' is no longer filtered' } );
		});

		runFilter( data );
	});
}

function notify( message ) {
	chrome.notifications.create({
		'type': 'basic',
		'iconUrl': chrome.runtime.getURL( '128icon.png' ),
		'title': message.title || 'Filter Affinity',
		'message': message.text
	});
}

function sortRequest( request, sender, resp ) {
	resp();
	switch( request.type ) {
		case 'requestData':
			getData();
			break;
		case 'save': 
			save( request.data ); 
			break;
		case 'addArtist':
			addArtist( request.data );
			break;
		case 'removeArtist':
			removeArtist( request.data );
			break;
		case 'message': 
			notify( request.data );
			break;
		case 'clear':
			clear( request.data );
			break;
	}
}
