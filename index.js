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

var Twitter = require('twitter');

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

module.exports = function(robot) {
  robot.respond(/tweet (.*)/i, function(msg) {
    var thread = msg.message.metadata.thread_id;
    robot.brain.set("tweet." +  thread, {"message": msg.match[1], "ok": [msg.message.user.id]});
    console.log("Adding tweet for thread: " + thread);
    msg.reply("Confirm tweet by replying \"OK\" to this thread, or \"Cancel\" to abort.");
  });

  robot.respond(/retweet http[s]?:\/\/twitter\.com\/(.*)\/status\/([0-9]*)/i, function(msg) {
    var thread = msg.message.metadata.thread_id;
    robot.brain.set("tweet." +  thread, {"tweetid": msg.match[2], "ok": [msg.message.user.id]});
    console.log("Adding retweet for thread: " + thread);
    msg.reply("Confirm retweet by replying \"OK\" to this thread, or \"Cancel\" to abort.");
  });

  robot.hear(/^ok$/i, function(msg) {
    var thread = msg.message.metadata.thread_id;

    var tweet = robot.brain.get("tweet." + thread);

    if (tweet) {
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
