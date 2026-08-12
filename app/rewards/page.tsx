"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNavigation from "@/components/BottomNavigation";
import { createClient } from "@/lib/supabase/client";
import "./rewards.css";
import "./equip.css";

const supabase = createClient();
type Item = { id:string; name:string; category:"hat"|"collar"|"bowl"|"piggy_bank"; rarity:"common"|"rare"|"legendary"; sprite_index:number };
type EquippedRow = { category:string; item_id:string };

function Sprite({ index, locked=false }:{ index:number; locked?:boolean }) {
  const collarImages:Record<number,string>={4:"/reward-accessories/mint-tag-v1.png",5:"/reward-accessories/red-bow-charm-v2.png",6:"/reward-accessories/blue-heart-v1.png",7:"/reward-accessories/star-pendant-v1.png"};
  if(collarImages[index]) return <span className={`reward-sprite accessory-sprite${locked?" locked":""}`} aria-hidden="true"><img src={collarImages[index]} alt="" /></span>;
  return <span className={`reward-sprite${locked ? " locked" : ""}`} style={{backgroundPosition:`${index%4*(100/3)}% ${Math.floor(index/4)*50}%`}} aria-hidden="true" />;
}

export default function RewardsPage() {
  const router=useRouter();
  const [items,setItems]=useState<Item[]>([]);
  const [owned,setOwned]=useState<Set<string>>(new Set());
  const [equipped,setEquipped]=useState<Record<string,string>>({});
  const [tickets,setTickets]=useState(0);
  const [loading,setLoading]=useState(true);
  const [drawing,setDrawing]=useState(false);
  const [equipping,setEquipping]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [result,setResult]=useState<Item|null>(null);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/login");return;}
    await Promise.all([
      supabase.rpc("claim_weekly_reward"),
    ]);
    const [a,b,c,d]=await Promise.all([
      supabase.from("reward_items").select("id,name,category,rarity,sprite_index").eq("is_active",true).in("category",["hat","collar"]).order("sprite_index"),
      supabase.from("user_inventory").select("item_id"),
      supabase.from("reward_tickets").select("balance").eq("user_id",user.id).maybeSingle(),
      supabase.from("equipped_reward_items").select("category,item_id"),
    ]);
    if(a.error) setMessage("보상 데이터베이스 설정이 아직 필요해요.");
    else {
      const visibleItems=(a.data as Item[])??[];
      const visibleIds=new Set(visibleItems.map(item=>item.id));
      setItems(visibleItems);
      setOwned(new Set((b.data??[]).map(x=>x.item_id).filter(id=>visibleIds.has(id))));
      setTickets(Number(c.data?.balance??0));
      setEquipped(Object.fromEntries(((d.data as EquippedRow[]|null)??[]).map(x=>[x.category,x.item_id])));
    }
    setLoading(false);
  },[router]);
  useEffect(()=>{void load();},[load]);

  const draw=async()=>{
    if(drawing||tickets<1||owned.size>=items.length)return;
    setDrawing(true);setMessage("");
    const {data,error}=await supabase.rpc("draw_reward_item");
    if(error)setMessage(error.message); else {const item=data as Item;setResult(item);setOwned(x=>new Set(x).add(item.id));setTickets(x=>Math.max(0,x-1));}
    setDrawing(false);
  };
  const equip=async(item:Item)=>{
    if(!owned.has(item.id)||equipping)return;
    setEquipping(item.id);setMessage("");
    const wearing=equipped[item.category]===item.id;
    const {error}=wearing
      ? await supabase.rpc("unequip_reward_item",{target_category:item.category})
      : await supabase.rpc("equip_reward_item",{target_item:item.id});
    if(error)setMessage(error.message);
    else if(wearing)setEquipped(x=>{const next={...x};delete next[item.category];return next;});
    else setEquipped(x=>({...x,[item.category]:item.id}));
    setEquipping(null);
  };

  const complete=items.length>0&&owned.size>=items.length;
  const display=items.length?items:Array.from({length:12},(_,i)=>({id:`empty-${i}`,name:"준비 중",category:"hat",rarity:"common",sprite_index:i} as Item));
  return <main className="rewards-page">
    <header className="rewards-header"><button onClick={()=>router.push("/")} aria-label="홈으로">‹</button><div><span>초롱이 보물상자</span><h1>중복 없는 뽑기</h1></div><div className="ticket-count"><span>🎟️</span><strong>{tickets}</strong></div></header>
    <section className="draw-card"><div className="draw-glow"><img src="/chorong-mint-collar-no-charm-v2.png" alt="초롱이"/></div><div className="draw-copy"><span className="rarity-pill">일반 컬렉션</span><h2>{owned.size} / {items.length||12}개 수집</h2><p>지난주 개인 주간 예산의 80% 이하로 썼다면<br/>각자 뽑기권을 1장 받아요.</p></div><button className="draw-button" onClick={draw} disabled={loading||drawing||tickets<1||complete}>{drawing?"두근두근 뽑는 중…":complete?"일반 아이템 수집 완료":tickets<1?"뽑기권이 없어요":"뽑기권 1장 사용하기"}</button><small>주간 예산은 개인 월 예산을 4주로 나눠 계산해요</small></section>
    {message&&<p className="reward-message">{message}</p>}
    <section className="collection-section"><div className="collection-title"><div><span>COLLECTION</span><h2>일반 아이템</h2></div><strong>{owned.size}/{items.length||12}</strong></div><p className="equip-guide">보유한 아이템을 누르면 홈의 초롱이에게 바로 적용돼요.</p><div className="collection-grid">{display.map(item=>{const has=owned.has(item.id),wearing=equipped[item.category]===item.id;return <button type="button" disabled={!has||!!equipping} onClick={()=>equip(item)} className={`collection-item${has?" owned":""}${wearing?" equipped":""}`} key={item.id}><Sprite index={item.sprite_index} locked={!has}/><span className="common-dot">{wearing?"착용 중":"일반"}</span><strong>{has?item.name:"???"}</strong></button>;})}</div><div className="future-rarity"><span>🔒 희귀</span><span>🔒 전설</span><small>더 특별한 아이템은 다음 업데이트에서 열려요</small></div></section>
    {result&&<div className="result-backdrop" onClick={()=>setResult(null)}><section className="result-modal" onClick={e=>e.stopPropagation()}><span className="result-label">NEW!</span><Sprite index={result.sprite_index}/><p>일반 아이템</p><h2>{result.name}</h2><small>아이템을 눌러 초롱이에게 적용할 수 있어요</small><button onClick={()=>setResult(null)}>확인</button></section></div>}
    <BottomNavigation active="home"/>
  </main>;
}
