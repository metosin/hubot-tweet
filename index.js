// Description:
//   Send tweets with confirmation to Flowdock thread
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   hubot tweet <message>
//   hubot retweet <url>
//
// Author:
//   Deraen
//
// Create Twitter app:
// https://developer.twitter.com/en/apps

var Twitter = require('twitter');

var clients = {};

function get_or_create_client(channel) {
  if (clients[channel]) {
    return clients[channel];
  } else {
    var key = process.env[channel + '_TWITTER_CONSUMER_KEY'];
    var secret = process.env[channel + '_TWITTER_CONSUMER_SECRET'];
    var token_key = process.env[channel + '_TWITTER_ACCESS_TOKEN_KEY'];
    var token_secret = process.env[channel + '_TWITTER_ACCESS_TOKEN_SECRET'];

    if (!key || !secret || !token_key || !token_secret) {
      console.warn("No tweet configuration for channel " + channel);
      return;
    }

    var client = new Twitter({
      consumer_key: key,
      consumer_secret: secret,
      access_token_key: token_key,
      access_token_secret: token_secret,
    });

    clients[channel] = client;
    return client;
  }
}

module.exports = function(robot) {
  robot.respond(/tweet (.*)/i, function(msg) {
    var client = get_or_create_client(msg.message.metadata.room);
    if (!client) {
      msg.reply("No twitter integration configured for this channel");
      return;
    }

    var thread = msg.message.metadata.thread_id;
    robot.brain.set("tweet." +  thread, {"message": msg.match[1], "ok": [msg.message.user.id]});
    console.log("Adding tweet for thread: " + thread);
    msg.reply("Confirm tweet by replying \"OK\" to this thread, or \"Cancel\" to abort.");
  });

  robot.respond(/retweet http[s]?:\/\/twitter\.com\/(.*)\/status\/([0-9]*)/i, function(msg) {
    var client = get_or_create_client(msg.message.metadata.room);
    if (!client) {
      msg.reply("No twitter integration configured for this channel");
      return;
    }

    var thread = msg.message.metadata.thread_id;
    robot.brain.set("tweet." +  thread, {"tweetid": msg.match[2], "ok": [msg.message.user.id]});
    console.log("Adding retweet for thread: " + thread);
    msg.reply("Confirm retweet by replying \"OK\" to this thread, or \"Cancel\" to abort.");
  });

  robot.hear(/^ok$/i, function(msg) {
    var thread = msg.message.metadata.thread_id;

    var tweet = robot.brain.get("tweet." + thread);

    if (tweet) {
      var client = get_or_create_client(msg.message.metadata.room);
      if (!client) {
        msg.reply("No twitter integration configured for this channel");
        return;
      }

      console.log("Confirmation for thread: " + thread);

      tweet.ok.push(msg.message.user.id);

      if (tweet.ok.length >= 2) {
        msg.reply("Tweeting now");

        if (tweet.message) {
          client.post('statuses/update', {status: tweet.message}, function(error, tweet, response) {
            if (error) {
              msg.reply("FAIL");
            }
          });
        } else if (tweet.tweetid) {
          client.post('statuses/retweet/' + tweet.tweetid, function(error, tweet, response) {
            if (error) {
              msg.reply("FAIL");
            }
          });
        }

        robot.brain.remove("tweet." + thread);
      } else {
        msg.reply("I need more confirmations.");
      }
    } else {
      console.log("No tweet found for thread: " + thread);
    }
  });


  robot.hear(/^(cancel|abort|halt)$/i, function(msg) {
    var thread = msg.message.metadata.thread_id;

    var tweet = robot.brain.get("tweet." + thread);

    if (tweet) {
      msg.reply("Cancelled");
      robot.brain.remove("tweet." + thread);
    } else {
      console.log("No tweet found for thread: " + thread);
    }
  });
};
