'use strict';

const fs = require( 'fs' );

const Canvas = require( 'canvas' );
const request = require( 'request' );
const Twit = require( 'twit' );

const config = require( './config.json' );

const t = new Twit({
	consumer_key: config.consumer_key,
	consumer_secret: config.consumer_secret,
	access_token: config.access_token,
	access_token_secret: config.access_token_secret,
});

const Image = Canvas.Image

const wrap = ( text, maxWidth, imageHeight, context ) => {

	context.font = 'italic 20px "Times New Roman"';
	context.fillStyle = '#000000';

	let words = text.split( ' ' );

	let lines = [];

	words.forEach( word => {

		if ( lines.length === 0 ) {
			lines.push( [] );
		}

		let line = lines[lines.length - 1];

		if ( context.measureText( line.concat( [ word ] ).join( ' ' ) ).width > maxWidth - 20 ) {
			lines.push( [] );
			line = lines[lines.length - 1];
		}

		line.push( word );

	} );

	lines.forEach( ( line, i ) => {

		let lineWidth = context.measureText( line.join( ' ' ) ).width;

		let x = ( maxWidth - lineWidth ) / 2;
		let y = ( i * 25 ) + 20 + imageHeight;

		context.fillText( line.join( ' ' ), x, y );

	} );

}

const url = 'https://www.newyorker.com/open/cartoons.json';

const tweetCartoon = () => {

	request( url, ( error, response, body ) => {
		let feed = JSON.parse( body ).items.filter( d => {
			return d.rubric === 'Daily Cartoon';
		} );
		let cartoon = feed[0];
		let caption = feed.filter( d => d.id !== cartoon.id )[Math.floor( Math.random() * ( feed.length - 1 ) )].excerpt;
		request( cartoon.featured_media.sizes.thumbnail.url )
			.pipe( fs.createWriteStream( './temp-raw.jpg' ) )
			.on( 'close', () => {
				let file = fs.readFileSync( './temp-raw.jpg' )

				let canvas = new Canvas(
					cartoon.featured_media.sizes.thumbnail.width * 2,
					( cartoon.featured_media.sizes.thumbnail.height * 2 ) + 100
				);
				let context = canvas.getContext( '2d' );

				let image = new Image();
				image.src = file;

				context.fillStyle = '#ffffff';
				context.fillRect( 0, 0, image.width * 2, ( image.height * 2 ) + 115 );

				context.drawImage( image, 0, 0, image.width * 2, image.height * 2 );

				wrap( caption, image.width * 2, image.height * 2, context );

				let out = fs.createWriteStream( './temp.png' );
				let stream = canvas.pngStream();

				stream.on( 'data',  ( chunk ) => {
					out.write( chunk );
				} );

				stream.on( 'end', () => {

					setTimeout( () => {

						let content = fs.readFileSync( './temp.png', { encoding: 'base64' } );

						t.post( 'media/upload', { media_data: content }, ( error, data, response ) => {

							if ( !error ) {

								let mediaId = data.media_id_string;
								let alt = caption;
								let mediaMetaParams = { media_id: mediaId, alt_text: { text: alt } };

								t.post( 'media/metadata/create', mediaMetaParams, ( error, data, response ) => {

									if ( !error ) {

										let status = `How droll! ${cartoon.link}`;

										let params = { status: status, media_ids: [ mediaId ] };

										t.post( 'statuses/update', params, ( error, data, response ) => {
											console.log( error ? error : 'Cartoon posted.' );
										} );
									} else {
										console.log( error );
									}

								} );
							} else {

								console.log( error );

							}

						} );

					}, 500 );

				} );

			} );
	} );

};

tweetCartoon();
setInterval( tweetCartoon, 3600000 * 24 );