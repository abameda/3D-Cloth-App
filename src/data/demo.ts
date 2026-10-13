import type {Garment} from '../domain/types';
const rows: Array<[string,Garment['category'],Garment['color'],Garment['formality'],Garment['warmth']]>=[
 ['Cotton tee','top','White',1,1],['Oxford shirt','top','Blue',3,2],['Soft knit','top','Beige',2,3],['Everyday tee','top','Black',1,1],
 ['Straight denim','bottom','Blue',1,2],['Tailored trousers','bottom','Navy',3,2],['Easy chinos','bottom','Beige',2,1],
 ['Court sneakers','shoes','White',1,1],['Leather loafers','shoes','Brown',3,2],['Everyday boots','shoes','Black',2,3],
 ['Light overshirt','outerwear','Green',1,2],['Wool coat','outerwear','Grey',3,3],['Canvas tote','accessories','Beige',1,1],['Classic watch','accessories','Black',3,1],['Linen one-piece','onepiece','Beige',2,1],['Everyday bag','bag','Brown',2,1],['Sunglasses','eyewear','Black',1,1]
];
export const demoGarments:Garment[]=rows.map(([name,category,color,formality,warmth],index)=>({id:`example-${index+1}`,name,category,color,formality,warmth,fit:'Regular',available:true,favorite:false,styles:formality===3?['Classic']:['Minimal','Relaxed'],source:'example',createdAt:'2026-09-18T00:00:00.000Z'}));
