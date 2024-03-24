require('dotenv').config();
const { Telegraf, session,  Markup } = require('telegraf');
const {TOKEN, OPENAI_API_KEY} = process.env;
const {OpenAI, Image} = require('openai');
const fs = require('fs');
const {v4: uuidV4 } = require('uuid');
let factGenerator = require('./factGenerator');

const openai = new OpenAI(OPENAI_API_KEY);
const bot = new Telegraf(TOKEN);

bot.use(session({ defaultSession: () => ({ userChoice: '', editingRequirement: null }) }));

bot.start((ctx) => {
    const txt = `   😄 Hey! 
I'm a QuestBot 🤖 trying to solve all of your queries through text/image and if want to make the variation/edit the generate image then i'm capable for doing that task.🦾 
So tell me how can i help you in your doubts.
    `;
    const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('Generate Image', 'generate_image'),
        Markup.button.callback('Generate Text', 'generate_text'),
        Markup.button.callback('Set system Personna', 'system_personna')
    ], {columns: 1});

    ctx.session.userChoice = '';
    ctx.reply(txt, keyboard);
});

bot.action('generate_image', (ctx) => {
    ctx.session.userChoice = 'image';
    ctx.reply('You selected to generate images.');
});

bot.action('generate_text', (ctx) => {
    ctx.session.userChoice = 'text';
    ctx.reply('You selected to generate text.');
});

bot.action('system_personna', (ctx) => {
    ctx.session.userChoice = 'personna';
    const user_name = ctx.chat.first_name;
    const mssg = `Hello ${user_name} ! 
    Welcome to the System Persona Setting! This innovative feature empowers you to tailor your interaction with our bot to align perfectly with your preferences and needs.`;
    const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('Start', 'start_assistant')
    ], {columns: 1});
    ctx.reply(mssg, keyboard);
});

bot.action('start_assistant', async (ctx) => {
    
    try{
        const assistant = await openai.beta.assistants.create({
            name: "Math Tutor",
            instructions: "You are a personal math tutor. Write and run code to answer math questions.",
            tools: [{ type: "code_interpreter" }],
            model: "gpt-3.5-turbo-1106"
          });

        console.log(`Assistant created successfully: ${assistant}`);
    
        const thread = await openai.beta.threads.create();
    
        const message = await openai.beta.threads.messages.create(
            thread.id,
            {
              role: "user",
              content: "I need to solve equation `3x + 11 = 14`. Can you help me?"
            }
        );
    
        const run = await openai.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: assistant.id,
                instructions: "Please address the user as Shreya Pandey. User don't have the premium account."
            }
        );

        console.log(`Run created successfully ${run}`);
    
        const Run = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
          );
    

        console.log(`Retrieve run created ${Run}`);

        const messages = await openai.beta.threads.messages.list(
            thread.id
        );
        
        console.log(message);
        console.log(messages);
        await ctx.reply(`${messages}`);
    
    }catch(err){
        console.log(`Error in creating assistant ${err}`);
    }
});


bot.on('message', async (ctx) => {
    const userChoice = ctx.session.userChoice || '';
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id;
    const user = ctx.chat.first_name;
    console.log(`Received message from chat ID ${chatId} by ${user}: ${userMessage}`);
    ctx.telegram.sendChatAction(chatId, 'typing');
    setTimeout(async() => {
        try{
            if(userChoice === 'image'){
                const imageResponse = await generateImageResponse(userMessage);
                if(imageResponse.data && imageResponse.data.length > 0){
                    const imageUrl = imageResponse.data[0].url;
                    console.log(`Image generation is on the way.`);
                    await ctx.replyWithPhoto({ url: imageUrl});
                }else{
                    console.log(`No image URL found in the response: ${imageResponse}`);
                    await ctx.reply(`Sorry, unable to generate an image at the moment.`);
                }
            } else if(userChoice === 'text'){
                const response = await generateTextResponse(userMessage);
    
            
                console.log(`Generating text response`);
                await ctx.reply(response.choices[0].message.content);
            } else{
                console.log(`No userChoice has been made`);
                await ctx.reply(`Please select either which kind of operation do you want to perform.`);
            }
        } catch(err){
            console.log(`Error generating response: ${err}`);
            await ctx.reply('Sorry, there was an error in processing your request.');
        }
    }, 5000);
});


async function generateImageResponse(userMessage, retries = 3, delay = 1000){
    try{
        const response = await openai.images.generate({
            model: "dall-e-2",
            prompt: userMessage,
            size: "1024x1024",
            quality: "standard",
            n: 1,
        });
        return response;
    } catch(err) {
        if(retries > 0 && err.response && err.response.status === 429){
            console.log('Rate limit exceeded. Waiting before retrying...');
            await new Promise(resolve => setTimeout(resolve, delay));
            return generateImageResponse(userMessage, retries - 1, delay*2);
        } else{
            throw err;
        }
    }
}


async function generateTextResponse(userMessage){
    const stream = await openai.chat.completions.create({
        messages: [
            {role: "system", content: "You are a mother of two and your name is Siri"},
            {role: "system", content: "You are a mother of two"},
            {role: "system", content: "You are a busy women and don't find time for it"},
            {role: "user", content: userMessage},
            //{role:"assistant", content:"Assistant's message"}
        ],
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 1024,
        //stream: true,
    });
    return stream;
    
}


process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


bot.launch()
.then(() => {
    console.log('Bot is running!');
}).catch((err) => {
    console.log(`Error in starting the bot ${err}`);
});
