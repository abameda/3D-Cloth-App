import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchWeatherCities,fetchCityWeather,isWeatherFresh,isWeatherForCity} from '../src/domain/weather';
test('weather geocoding is explicit, bounded and returns validated city coordinates',async()=>{
  const cities=await searchWeatherCities('Cairo',(async url=>{assert.match(String(url),/^https:\/\/geocoding-api.open-meteo.com/);return new Response(JSON.stringify({results:[{id:1,name:'Cairo',country:'Egypt',latitude:30,longitude:31}]}));})as typeof fetch);
  assert.equal(cities[0].name,'Cairo, Egypt');
  await assert.rejects(searchWeatherCities('a'));await assert.rejects(searchWeatherCities('city',(async()=>new Response(JSON.stringify({results:[{name:'city',latitude:900,longitude:0}]})))as typeof fetch));
});
test('forecast records actual temperature, observation time and freshness',async()=>{
  const now=Date.parse('2026-10-12T10:00:00Z');
  const forecast=await fetchCityWeather({name:'Cairo',latitude:30,longitude:31},(async url=>{assert.match(String(url),/timezone=UTC/);return new Response(JSON.stringify({current:{time:'2026-10-12T10:00',temperature_2m:28,weather_code:0}}));})as typeof fetch,now);
  assert.equal(forecast.conditions,'Warm');assert.equal(forecast.temperatureC,28);assert.ok(isWeatherFresh(forecast,now));assert.equal(isWeatherFresh(forecast,now+3*3600000),false);
  assert.ok(isWeatherForCity(forecast,{name:'Cairo',latitude:30,longitude:31}));
  assert.equal(isWeatherForCity(forecast,{name:'Other city',latitude:30,longitude:31}),false);
  assert.equal(isWeatherForCity(forecast,{name:'Cairo',latitude:0,longitude:0}),false);
  assert.equal(isWeatherForCity({...forecast,latitude:undefined,longitude:undefined},{name:'Cairo',latitude:30,longitude:31}),false);
});
test('weather rejects unknown provider response, bad coordinates and failed transport',async()=>{
  await assert.rejects(fetchCityWeather({name:'City',latitude:100,longitude:0}));
  await assert.rejects(fetchCityWeather({name:'City',latitude:0,longitude:0},(async()=>new Response('{}'))as typeof fetch));
  await assert.rejects(fetchCityWeather({name:'City',latitude:0,longitude:0},(async()=>new Response('',{status:503}))as typeof fetch));
});
