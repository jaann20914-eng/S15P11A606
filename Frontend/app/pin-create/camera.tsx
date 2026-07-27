import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';
import { crowdLevels } from '@/constants/crowdLevels';
import type { CrowdLevelValue } from '@/constants/crowdLevels';

/** 혼잡한 단계를 왼쪽에 두는 세그먼트 순서 (와글와글 → 유유자적) */
const crowdSegments=[...crowdLevels].reverse();
const nearbyPlaces=['바나프레소 역삼1점','바나프레소 역삼점','바나프레소 역삼6점'];

export default function Capture(){
  const [level,setLevel]=useState<CrowdLevelValue>(1);
  const [recordState,setRecordState]=useState<'idle'|'recording'|'done'>('idle');
  const [memo,setMemo]=useState('');
  const [tagInput,setTagInput]=useState('');
  const [tags,setTags]=useState<string[]>(['카페']);
  const [place,setPlace]=useState('');
  const [placeOpen,setPlaceOpen]=useState(false);
  const [detail,setDetail]=useState('');
  const [processing,setProcessing]=useState(false);
  const spin=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(!processing){spin.setValue(0);return;}
    const animation=Animated.loop(Animated.timing(spin,{toValue:1,duration:1050,easing:Easing.linear,useNativeDriver:true}));
    animation.start();
    return ()=>animation.stop();
  },[processing,spin]);

  const toggleRecord=()=>setRecordState(state=>state==='idle'?'recording':state==='recording'?'done':'recording');
  const addTag=()=>{const value=tagInput.trim().replace(/^#/,'');if(!value||tags.length>=3)return;setTags(current=>current.includes(value)?current:[...current,value]);setTagInput('');};
  const submit=()=>{if(recordState!=='done')return Alert.alert('영상을 촬영해 주세요','갤러리 영상은 등록할 수 없으며 실시간 촬영이 필요해요.');if(!place)return Alert.alert('장소를 선택해 주세요','현재 위치 20m 내의 장소를 반드시 선택해야 해요.');setProcessing(true);};

  return <SafeAreaView style={s.safe}><View style={s.screen}>
    <View style={s.header}><Pressable accessibilityLabel="뒤로 가기" onPress={()=>router.back()} style={s.headerButton}><Ionicons name="chevron-back" size={24} color={colors.gray400}/></Pressable><Text style={s.headerTitle}>게시글 작성</Text><View style={s.headerButton}/></View>
    {processing?<View style={s.processingScreen}>
      <View style={[s.ambient,s.ambientWarm]}/>
      <View style={[s.ambient,s.ambientBlue]}/>
      <View style={s.loaderWrap}>
        <Animated.View style={[s.loaderTrack,{transform:[{rotate:spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}]}>
          <View style={s.loaderMask}/>
        </Animated.View>
        <View style={s.loaderCenter}><Text style={s.processingText}>AI를 이용하여{`\n`}블러 처리중입니다</Text></View>
      </View>
    </View>:<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.segment}>{crowdSegments.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityState={{selected:level===item.level}} onPress={()=>setLevel(item.level)} style={[s.segmentItem,level===item.level&&{backgroundColor:item.color}]}><Text style={[s.segmentText,level===item.level&&s.segmentTextActive]}>{item.label}</Text></Pressable>)}</View>

      <View style={s.camera}>
        <Image source={require('../../assets/images/capture-cafe-preview.png')} style={s.cameraImage}/>
        <View style={s.timer}><Text style={s.timerText}>{recordState==='idle'?'0:00:00':recordState==='recording'?'0:00:03':'0:00:05'}</Text></View>
        <Pressable accessibilityLabel={recordState==='recording'?'촬영 종료':'촬영 시작'} onPress={toggleRecord} style={s.recordOuter}><View style={[s.recordInner,recordState==='recording'&&s.recording,recordState==='done'&&s.recordDone]}/></Pressable>
      </View>

      <TextInput value={memo} onChangeText={setMemo} maxLength={50} multiline placeholder="내용 입력 (최대 50자)" placeholderTextColor={colors.gray400} style={s.memo}/>

      <Text style={s.label}>태그 <Text style={s.subLabel}>(최대 3개)</Text></Text>
      <View style={s.tags}>{tags.map(tag=><View key={tag} style={s.tag}><Text style={s.tagText}>#{tag}</Text><Pressable onPress={()=>setTags(current=>current.filter(item=>item!==tag))}><Ionicons name="close" size={14} color="#8A9D37"/></Pressable></View>)}</View>
      <View style={s.tagInputRow}><TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} editable={tags.length<3} placeholder="태그를 입력하세요" placeholderTextColor={colors.gray400} style={s.tagInput}/><Pressable onPress={addTag} disabled={tags.length>=3} style={[s.addButton,tags.length>=3&&s.disabled]}><Text style={s.addText}>입력</Text></Pressable></View>

      <Text style={s.label}>내 위치</Text>
      <Pressable onPress={()=>setPlaceOpen(open=>!open)} style={s.select}><Text style={[s.selectText,!place&&s.placeholder]}>{place||'현재 위치 〉'}</Text><Ionicons name={placeOpen?'chevron-up':'chevron-down'} size={18} color={colors.gray400}/></Pressable>
      {placeOpen&&<View style={s.placeList}>{nearbyPlaces.map(item=><Pressable key={item} onPress={()=>{setPlace(item);setPlaceOpen(false);}} style={s.placeRow}><View><Text style={s.placeName}>{item}</Text><Text style={s.placeAddress}>서울 광진구 동일로 60길 47 1층 (군자동)</Text></View>{place===item&&<Ionicons name="checkmark" size={18} color="#8FA400"/>}</Pressable>)}</View>}

      <Text style={s.label}>상세 위치</Text>
      <TextInput value={detail} onChangeText={setDetail} placeholder="선택 입력" placeholderTextColor={colors.gray400} style={s.detailInput}/>
      <Pressable onPress={submit} style={s.submit}><Text style={s.submitText}>영상핀 등록하기</Text></Pressable>
    </ScrollView>}
  </View></SafeAreaView>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.white},screen:{flex:1},header:{height:layout.headerHeight,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.x2,borderBottomWidth:1,borderBottomColor:colors.gray200},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},headerTitle:{...type.title,color:colors.dark},content:{paddingHorizontal:layout.gutter,paddingTop:spacing.x5,paddingBottom:120},segment:{height:52,flexDirection:'row',padding:4,borderRadius:radius.hero,backgroundColor:colors.white,borderWidth:1,borderColor:colors.gray200},segmentItem:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:radius.card},segmentText:{fontSize:13,lineHeight:19,fontWeight:'500',color:colors.gray600},segmentTextActive:{color:colors.dark,fontWeight:'600'},camera:{height:248,marginTop:spacing.x5,position:'relative',overflow:'hidden',borderRadius:radius.md,backgroundColor:colors.dark},cameraImage:{width:'100%',height:'100%',resizeMode:'cover'},timer:{position:'absolute',right:spacing.x2,top:spacing.x2,paddingHorizontal:spacing.x2,paddingVertical:2,borderRadius:4,backgroundColor:'rgba(0,0,0,.58)'},timerText:{fontSize:10,lineHeight:14,color:colors.white},recordOuter:{position:'absolute',bottom:spacing.x3,left:'50%',marginLeft:-25,width:50,height:50,borderRadius:25,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:colors.white,backgroundColor:'rgba(0,0,0,.15)'},recordInner:{width:38,height:38,borderRadius:19,backgroundColor:colors.white},recording:{borderRadius:8,backgroundColor:'#FF2633'},recordDone:{backgroundColor:colors.white},memo:{height:100,marginTop:spacing.x5,padding:spacing.x4,textAlignVertical:'top',borderRadius:radius.md,backgroundColor:colors.gray100,...type.small,color:colors.dark},label:{...type.label,color:colors.dark,fontWeight:'600',marginTop:spacing.x5,marginBottom:spacing.x2},subLabel:{...type.caption,color:colors.gray400},tags:{flexDirection:'row',flexWrap:'wrap',gap:spacing.x2},tag:{height:30,flexDirection:'row',alignItems:'center',gap:spacing.x1,paddingHorizontal:spacing.x3,borderRadius:radius.pill,backgroundColor:colors.limeSoft},tagText:{...type.caption,color:'#81942E'},tagInputRow:{height:44,flexDirection:'row',gap:spacing.x2,marginTop:spacing.x2},tagInput:{flex:1,paddingHorizontal:spacing.x4,borderRadius:radius.md,backgroundColor:colors.gray100,...type.small,color:colors.dark},addButton:{width:56,alignItems:'center',justifyContent:'center',borderRadius:radius.md,backgroundColor:colors.gray200},disabled:{opacity:.45},addText:{...type.label,color:colors.gray600},select:{height:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.x4,borderRadius:radius.md,backgroundColor:colors.gray100},selectText:{...type.body,color:colors.dark},placeholder:{color:colors.gray400},placeList:{marginTop:spacing.x2,overflow:'hidden',borderRadius:radius.md,borderWidth:1,borderColor:colors.gray200,backgroundColor:colors.white},placeRow:{minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.x4,borderBottomWidth:1,borderBottomColor:colors.gray100},placeName:{...type.label,color:colors.dark},placeAddress:{...type.caption,color:colors.gray400,marginTop:2},detailInput:{height:52,paddingHorizontal:spacing.x4,borderRadius:radius.md,backgroundColor:colors.gray100,...type.body,color:colors.dark},submit:{height:56,alignItems:'center',justifyContent:'center',marginTop:spacing.x8,borderRadius:radius.lg,backgroundColor:colors.lime},submitText:{fontSize:16,lineHeight:22,fontWeight:'600',color:colors.dark},processingScreen:{flex:1,alignItems:'center',justifyContent:'center',overflow:'hidden',backgroundColor:'#FBFCF8'},ambient:{position:'absolute',width:300,height:300,borderRadius:150,opacity:.42},ambientWarm:{right:-70,top:-30,backgroundColor:'#FFF0DA'},ambientBlue:{left:-90,bottom:40,backgroundColor:'#E8F7FC'},loaderWrap:{width:220,height:220,alignItems:'center',justifyContent:'center'},loaderTrack:{position:'absolute',width:206,height:206,borderRadius:103,borderWidth:10,borderColor:'#E9F6C8',borderTopColor:'#A7EF31',borderRightColor:'#C4E600'},loaderMask:{position:'absolute',width:16,height:16,borderRadius:8,backgroundColor:'#A7EF31',top:-3,left:84},loaderCenter:{width:176,height:176,borderRadius:88,alignItems:'center',justifyContent:'center',backgroundColor:colors.white},processingText:{fontSize:18,lineHeight:27,fontWeight:'600',letterSpacing:-.2,textAlign:'center',color:colors.gray600}});
