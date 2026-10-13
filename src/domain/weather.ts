import {z} from 'zod';
export const weatherCitySchema=z.object({name:z.string().min(1).max(160),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict();
export type WeatherCity=z.infer<typeof weatherCitySchema>;
export const weatherSnapshotSchema=z.object({city:z.string().min(1).max(160),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),temperatureC:z.number().finite().min(-90).max(65),code:z.number().int().min(0).max(99),observedAt:z.string().datetime(),fetchedAt:z.string().datetime(),conditions:z.enum(['Warm','Mild','Cold'])}).strict();
export type WeatherSnapshot=z.infer<typeof weatherSnapshotSchema>;
export function isWeatherForCity(value:WeatherSnapshot|undefined,city:WeatherCity|undefined){return !!value&&!!city&&value.city===city.name&&value.latitude===city.latitude&&value.longitude===city.longitude;}
export function isWeatherFresh(value:WeatherSnapshot|undefined,now=Date.now()){
  if(!value)return false;const observed=Date.parse(value.observedAt),fetched=Date.parse(value.fetchedAt);
  return Number.isFinite(observed)&&Number.isFinite(fetched)&&now>=fetched&&now-fetched<3600000&&now-observed<2*3600000&&observed<=now+10*60000;
}
async function read(url:string,transport:typeof fetch){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await transport(url,{signal:controller.signal,redirect:'error'});if(!response.ok)throw Error('Weather is unavailable. Choose conditions manually.');return await response.json();}
  catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error('Weather timed out. Choose conditions manually.');throw e;}
  finally{clearTimeout(timer);}
}
export async function searchWeatherCities(query:string,transport:typeof fetch=fetch):Promise<WeatherCity[]>{
  const name=z.string().trim().min(2).max(100).parse(query);
  const data=z.object({results:z.array(z.object({name:z.string().max(100),country:z.string().max(60).optional(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)})).max(8).optional()}).parse(await read(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`,transport));
  return(data.results??[]).map(c=>weatherCitySchema.parse({name:[c.name,c.country].filter(Boolean).join(', ').slice(0,160),latitude:c.latitude,longitude:c.longitude}));
}
export async function fetchCityWeather(city:WeatherCity,transport:typeof fetch=fetch,now=Date.now()):Promise<WeatherSnapshot>{
  const checked=weatherCitySchema.parse(city);
  const data=z.object({current:z.object({time:z.string(),temperature_2m:z.number().finite().min(-90).max(65),weather_code:z.number().int().min(0).max(99)})}).parse(await read(`https://api.open-meteo.com/v1/forecast?latitude=${checked.latitude}&longitude=${checked.longitude}&current=temperature_2m,weather_code&timezone=UTC&temperature_unit=celsius`,transport));
  const current=data.current,observedAt=new Date(`${current.time.replace(/Z$/,'')}Z`).toISOString();
  return weatherSnapshotSchema.parse({city:checked.name,latitude:checked.latitude,longitude:checked.longitude,temperatureC:current.temperature_2m,code:current.weather_code,observedAt,fetchedAt:new Date(now).toISOString(),conditions:current.temperature_2m>=25?'Warm':current.temperature_2m<=15?'Cold':'Mild'});
}
