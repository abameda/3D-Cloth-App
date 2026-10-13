import {createServer}from './service';
import {claudeRequest}from '../src/domain/claude';
import{features}from '../src/features';
if(!features.connectedAi){console.error('Connected AI is disabled.');process.exitCode=1;}else try{
 const apiKey=process.env.ANTHROPIC_API_KEY??'',model=process.env.ANTHROPIC_MODEL??'';
 if(!apiKey||!model)throw Error('Configure Anthropic and an available model');
 const port=Number(process.env.PORT??8787);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 const server=createServer({token:process.env.THREAD_SERVICE_TOKEN??'',provider:(task,input,signal)=>claudeRequest({provider:'anthropic',apiKey,model},task,input,signal)});
 server.on('error',()=>{console.error('Thread AI service could not listen. Check HOST and PORT.');process.exitCode=1;});
 server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Thread Anthropic metadata service listening on port ${port}.`));
}catch{console.error('Configure ANTHROPIC_API_KEY, an actual ANTHROPIC_MODEL ID, THREAD_SERVICE_TOKEN and valid port. No other paid model provider is enabled.');process.exitCode=1;}
