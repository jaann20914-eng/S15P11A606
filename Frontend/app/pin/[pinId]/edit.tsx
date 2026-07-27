import { useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

function BottomNavigation() {
  const items = [['home-outline','홈','/(tabs)/home'],['menu-outline','채팅','/(tabs)/chat/sent'],['add','제보','/(tabs)/write'],['search-outline','추천','/(tabs)/recommend'],['person-outline','마이','/(tabs)/mypage']] as const;
  return <View style={s.bottomNav}>{items.map(([icon,label,href],index)=><Pressable key={label} onPress={()=>router.push(href)} style={s.navItem}>{index===2?<View style={s.captureButton}><Ionicons name="add" size={32} color={colors.white}/></View>:<Ionicons name={icon} size={22} color={index===1?colors.lime:colors.gray400}/>}<Text style={[s.navLabel,index===1&&s.navActive,index===2&&s.captureLabel]}>{label}</Text></Pressable>)}</View>;
}

export default function MyVideo(){
  const [menuOpen,setMenuOpen]=useState(false);
  const removePost=()=>{setMenuOpen(false);Alert.alert('영상핀을 삭제할까요?','삭제한 영상핀은 다시 복구할 수 없어요.',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>router.replace('/(tabs)/mypage/activity')}]);};
  return <SafeAreaView style={s.safe}>
    <View style={s.header}><Pressable accessibilityLabel="뒤로 가기" onPress={()=>router.back()} style={s.headerButton}><Ionicons name="chevron-back" size={26} color={colors.gray400}/></Pressable><Text style={s.headerTitle}>영상핀</Text><Pressable accessibilityLabel="게시물 메뉴" onPress={()=>setMenuOpen(v=>!v)} style={s.headerButton}><Ionicons name="menu" size={29} color={colors.gray600}/></Pressable></View>
    {menuOpen&&<View style={s.menuPopover}><Pressable onPress={()=>{setMenuOpen(false);router.push('/pin-create/detail-form');}} style={s.menuRow}><Ionicons name="pencil" size={17} color={colors.gray600}/><Text style={s.menuText}>수정하기</Text></Pressable><View style={s.menuRule}/><Pressable onPress={removePost} style={s.menuRow}><Ionicons name="trash" size={17} color={colors.gray600}/><Text style={s.menuText}>삭제하기</Text></Pressable></View>}
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.videoFrame}><Image source={require('../../../assets/images/video-pin-crowd.png')} style={s.videoImage}/><Text style={s.videoCaption}>오늘 포켓몬 찐팬 아니면{`\n`}성수가면 안되는 이유</Text></View>
      <View style={s.detailSheet}>
        <View style={s.authorRow}><View style={s.viewRing}><Text style={s.viewRingText}>92°</Text></View><View style={s.authorCopy}><Text style={s.authorName}>역삼동 익명러</Text><Text style={s.authorMeta}>2층 창가석 기준 · 40초 전 업로드</Text></View></View>
        <Text style={s.placeName}>바나프레소 역삼점</Text><Text style={s.address}>서울 광진구 동일로 60길 47 1층 (군자동)</Text><View style={s.crowdChip}><Text style={s.crowdText}>약간 붐빔</Text></View><View style={s.rule}/>
        <Text style={s.memo}>2층 창가석에 앉아있습니다. 지금 사람이 엄청 많네요. 혹시 노트북 자리가 필요하신 분이 계시다면 3시반까지는 채팅 편하게 주세요.</Text><View style={s.tags}>{['#좌석없음','#콘센트','#조용함'].map(tag=><Text key={tag} style={s.tag}>{tag}</Text>)}</View>
        <View style={s.actions}><Pressable onPress={()=>router.back()} style={[s.actionButton,s.leftAction]}><Text style={s.leftActionText}>이미 떠났어요</Text></Pressable><Pressable onPress={()=>router.push('/chat-room/1')} style={[s.actionButton,s.rightAction]}><Text style={s.rightActionText}>채팅방으로 이동</Text></Pressable></View>
      </View>
    </ScrollView><BottomNavigation/>
  </SafeAreaView>;
}

const shadow={shadowColor:colors.dark,shadowOffset:{width:0,height:5},shadowOpacity:.15,shadowRadius:12,elevation:6};
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.white},header:{height:layout.headerHeight,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.x2,borderBottomWidth:1,borderBottomColor:colors.gray200},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},headerTitle:{...type.title,color:colors.dark},
  menuPopover:{position:'absolute',zIndex:10,top:52,right:12,width:124,borderRadius:radius.sm,borderWidth:1,borderColor:colors.gray200,backgroundColor:colors.white,...shadow},menuRow:{height:48,flexDirection:'row',alignItems:'center',gap:spacing.x3,paddingHorizontal:spacing.x4},menuRule:{height:1,backgroundColor:colors.gray200},menuText:{...type.label,color:colors.gray600},
  content:{paddingBottom:112},videoFrame:{height:316,position:'relative',overflow:'hidden',backgroundColor:colors.gray200},videoImage:{width:'100%',height:'100%',resizeMode:'cover'},videoCaption:{position:'absolute',left:0,right:0,top:132,textAlign:'center',fontSize:18,lineHeight:25,fontWeight:'500',color:colors.white,textShadowColor:'rgba(0,0,0,.58)',textShadowRadius:5},
  detailSheet:{marginTop:-8,paddingHorizontal:layout.gutter,paddingTop:spacing.x4,paddingBottom:spacing.x8,borderTopLeftRadius:radius.hero,borderTopRightRadius:radius.hero,backgroundColor:colors.white},authorRow:{minHeight:48,flexDirection:'row',alignItems:'center'},viewRing:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',borderWidth:4,borderColor:colors.lime,backgroundColor:colors.white},viewRingText:{fontSize:11,lineHeight:15,fontWeight:'600',color:colors.gray600},authorCopy:{flex:1,marginLeft:spacing.x3},authorName:{fontSize:16,lineHeight:22,fontWeight:'600',color:colors.dark},authorMeta:{...type.caption,color:colors.gray400,marginTop:2},
  placeName:{...type.title,color:colors.dark,marginTop:spacing.x5},address:{...type.caption,color:colors.gray400,marginTop:2},crowdChip:{alignSelf:'flex-start',marginTop:spacing.x2,paddingHorizontal:spacing.x3,paddingVertical:spacing.x1,borderRadius:radius.pill,backgroundColor:'#FFE3E4'},crowdText:{...type.caption,color:'#EF626B'},rule:{height:1,backgroundColor:colors.gray200,marginVertical:spacing.x4},memo:{fontSize:14,lineHeight:21,fontWeight:'400',color:colors.gray600},tags:{flexDirection:'row',gap:spacing.x3,marginTop:spacing.x3},tag:{...type.caption,color:'#2F80ED'},
  actions:{flexDirection:'row',gap:spacing.x2,marginTop:spacing.x10},actionButton:{flex:1,height:56,alignItems:'center',justifyContent:'center',borderRadius:radius.md},leftAction:{backgroundColor:colors.dark},rightAction:{backgroundColor:'#D9ED76'},leftActionText:{fontSize:16,lineHeight:22,fontWeight:'600',color:colors.lime},rightActionText:{fontSize:16,lineHeight:22,fontWeight:'600',color:colors.dark},
  bottomNav:{position:'absolute',left:0,right:0,bottom:0,height:72,flexDirection:'row',paddingTop:spacing.x2,paddingBottom:spacing.x2,borderTopWidth:1,borderTopColor:colors.gray200,backgroundColor:colors.white},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navLabel:{...type.caption,fontSize:11,lineHeight:16,color:colors.gray400,fontWeight:'600'},navActive:{color:colors.lime},captureButton:{width:52,height:52,marginTop:-25,alignItems:'center',justifyContent:'center',borderRadius:17,borderWidth:3,borderColor:colors.white,backgroundColor:'#D9ED76',...shadow},captureLabel:{marginTop:spacing.x2}
});
