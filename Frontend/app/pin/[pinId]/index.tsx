import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StaticBottomNav } from '@/components/common/BottomNav';
import type { NavTab } from '@/components/common/BottomNav';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

const tabRoutes: Record<NavTab, string> = {
  home: '/(tabs)/home',
  recommend: '/(tabs)/recommend',
  chat: '/(tabs)/chat/sent',
  mypage: '/(tabs)/mypage',
};

function ViewRing() {
  return <View style={s.viewRing}><Text style={s.viewRingText}>92°</Text></View>;
}

/** 탭 밖 화면이라 바텀바를 직접 그린다. 규격·시스템 바 여백은 공통 컴포넌트가 처리한다. */
function BottomNavigation() {
  return (
    <StaticBottomNav
      active="home"
      onPressTab={(tab) => router.push(tabRoutes[tab] as never)}
      onPressCapture={() => router.push('/(tabs)/write')}
    />
  );
}

export default function Video() {
  const [paid, setPaid] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [chatModal, setChatModal] = useState(false);
  const [chatPending, setChatPending] = useState(false);
  const [rating, setRating] = useState<'helpful' | 'miss' | null>(null);

  const confirmPayment = () => {
    setPaid(true);
    setPayModal(false);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.headerButton}>
          <Ionicons name="chevron-back" size={25} color={colors.gray400}/>
        </Pressable>
        <Text style={s.headerTitle}>영상핀</Text>
        <Pressable accessibilityLabel="신고" style={s.reportButton}>
          <Ionicons name="notifications" size={18} color={colors.gray400}/><Text style={s.reportText}>신고</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.videoFrame}>
          <Image source={require('../../../assets/images/video-pin-crowd.png')} blurRadius={paid ? 0 : 18} style={s.videoImage}/>
          {paid && <Text style={s.videoCaption}>오늘 포켓몬 찐팬 아니면{`\n`}성수가면 안되는 이유</Text>}
        </View>

        <View style={s.detailSheet}>
          <View style={s.authorRow}>
            <ViewRing/>
            <View style={s.authorCopy}>
              <Text style={s.authorName}>역삼동 익명러</Text>
              <Text style={s.authorTrust}>신뢰도 상위 12%</Text>
              <Text style={s.authorMeta}>2층 창가석 기준 · 40초 전 업로드</Text>
            </View>
            {paid && (
              <Pressable onPress={() => chatPending ? undefined : setChatModal(true)} style={[s.chatButton, chatPending && s.chatPending]}>
                <Text style={s.chatText}>{chatPending ? '수락 대기' : '채팅 요청'}</Text>
              </Pressable>
            )}
          </View>

          <Text style={s.placeName}>바나프레소 역삼점</Text>
          <Text style={s.address}>서울 광진구 동일로 60길 47 1층 (군자동)</Text>
          <View style={s.rule}/>
          <Text style={s.memo}>2층 창가석에 앉아있습니다. 지금 사람이 엄청 많네요. 혹시 노트북 자리가 필요하신 분이 계시다면 3시반까지는 채팅 편하게 주세요.</Text>
          <View style={s.tags}>{['#좌석없음', '#콘센트', '#조용함'].map((tag) => <Text key={tag} style={s.tag}>{tag}</Text>)}</View>

          {!paid ? (
            <View style={s.watchArea}>
              <Text style={s.watchTitle}>현장 영상을 확인할까요?</Text>
              <Text style={s.watchHint}>3크레딧을 사용하면 전체 블러가 해제돼요.</Text>
              <Pressable onPress={() => setPayModal(true)} style={[s.primaryDark, s.watchButton]}><Text style={s.primaryDarkText}>영상보기</Text></Pressable>
            </View>
          ) : (
            <View style={s.ratingArea}>
              {rating ? (
                <>
                  <Text style={s.selectedRating}>{rating === 'helpful' ? '유익해요!' : '아쉬워요!'}</Text>
                  <View style={s.reward}>
                    <View style={s.rewardCoin}><Ionicons name="leaf" size={24} color="#91A700"/></View>
                    <View>
                      <Text style={s.rewardTitle}>1크레딧을 받았어요</Text>
                      <Text style={s.rewardText}>게시자의 뷰 신뢰도에도 반영했어요.</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.ratingTitle}>이 영상핀이 유익했나요?</Text>
                  <Text style={s.ratingHint}>평가하면 1크레딧을 적립하고 게시자의 뷰에 반영해요.</Text>
                  <View style={s.ratingButtons}>
                    <Pressable onPress={() => setRating('helpful')} style={[s.ratingButton, s.helpfulButton]}><Text style={s.helpfulText}>유익해요</Text></Pressable>
                    <Pressable onPress={() => setRating('miss')} style={[s.ratingButton, s.missButton]}><Text style={s.missText}>아쉬워요</Text></Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNavigation/>

      <Modal visible={payModal} transparent animationType="fade" onRequestClose={() => setPayModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHead}><View><Text style={s.modalTitle}>뷰포인트 결제</Text><Text style={s.modalCaption}>결제된 영상에 대하여 포인트 환불이 불가합니다</Text></View><Pressable onPress={() => setPayModal(false)} style={s.modalClose}><Ionicons name="close" size={18} color={colors.white}/></Pressable></View>
            <View style={s.payPanel}>
              <Image source={require('../../../assets/images/credit-coin-3d.png')} style={s.coinImage}/>
              <Text style={s.payMessage}>영상 확인을 위해서는{`\n`}뷰포인트가 -3 차감됩니다</Text>
              <Pressable onPress={confirmPayment} style={s.primaryDark}><Text style={s.primaryDarkText}>동의하고 결제하기</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={chatModal} transparent animationType="fade" onRequestClose={() => setChatModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.chatModalCard}>
            <Text style={s.modalTitle}>채팅 요청</Text>
            <Image source={require('../../../assets/images/chat-request-3d.png')} style={s.chatIllustration}/>
            <Pressable onPress={() => { setChatModal(false); setChatPending(true); }} style={s.chatStart}><Text style={s.chatStartText}>5 크레딧 차감 후 채팅 시작하기</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const shadow = { shadowColor: colors.dark, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 };
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.white},
  header:{height:layout.headerHeight,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.x3,borderBottomWidth:1,borderBottomColor:colors.gray200},
  headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  headerTitle:{...type.title,color:colors.dark},
  reportButton:{minWidth:52,height:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.x1},
  reportText:{...type.caption,color:colors.gray600},
  content:{paddingBottom:112},
  videoFrame:{height:294,position:'relative',overflow:'hidden',backgroundColor:colors.gray200},
  videoImage:{width:'100%',height:'100%',resizeMode:'cover'},
  videoCaption:{position:'absolute',left:0,right:0,top:120,textAlign:'center',fontSize:18,lineHeight:25,fontWeight:'500',color:colors.white,textShadowColor:'rgba(0,0,0,.55)',textShadowRadius:5},
  detailSheet:{marginTop:-8,paddingHorizontal:layout.gutter,paddingTop:spacing.x6,paddingBottom:spacing.x8,borderTopLeftRadius:radius.hero,borderTopRightRadius:radius.hero,backgroundColor:colors.white},
  authorRow:{minHeight:48,flexDirection:'row',alignItems:'center'},
  viewRing:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',borderWidth:4,borderColor:colors.lime,backgroundColor:colors.white},
  viewRingText:{fontSize:11,lineHeight:15,fontWeight:'600',color:colors.gray600},
  authorCopy:{flex:1,marginLeft:spacing.x3},
  authorName:{fontSize:16,lineHeight:22,fontWeight:'600',color:colors.dark},
  authorTrust:{...type.caption,color:colors.gray400,marginTop:spacing.x1},
  authorMeta:{...type.small,color:colors.gray400,marginTop:spacing.x2},
  chatButton:{height:40,paddingHorizontal:spacing.x4,alignItems:'center',justifyContent:'center',borderRadius:radius.md,backgroundColor:colors.dark},
  chatPending:{backgroundColor:colors.gray400},
  chatText:{...type.label,color:colors.white,fontWeight:'600'},
  placeName:{...type.h3,fontWeight:'700',color:colors.dark,marginTop:spacing.x8},
  address:{...type.body,color:colors.gray400,marginTop:spacing.x2},
  rule:{height:1,backgroundColor:colors.gray200,marginVertical:spacing.x6},
  memo:{...type.body,color:colors.gray400},
  tags:{flexDirection:'row',gap:spacing.x4,marginTop:spacing.x3},
  tag:{...type.small,color:colors.blue},
  watchArea:{marginTop:spacing.x12},
  watchTitle:{...type.title,color:colors.dark},
  watchHint:{...type.body,color:colors.gray400,marginTop:spacing.x2},
  watchButton:{marginTop:spacing.x4},
  primaryDark:{height:52,alignItems:'center',justifyContent:'center',borderRadius:radius.md,backgroundColor:colors.dark},
  primaryDarkText:{fontSize:16,lineHeight:22,fontWeight:'600',color:colors.lime},
  ratingArea:{marginTop:spacing.x10},
  selectedRating:{fontSize:16,lineHeight:24,fontWeight:'500',color:'#A3A78F'},
  ratingTitle:{...type.label,color:colors.dark,fontWeight:'600'},
  ratingHint:{...type.caption,color:colors.gray600,marginTop:spacing.x1},
  ratingButtons:{flexDirection:'row',gap:spacing.x2,marginTop:spacing.x4},
  ratingButton:{flex:1,height:52,alignItems:'center',justifyContent:'center',borderRadius:radius.md},
  helpfulButton:{backgroundColor:colors.lime},
  missButton:{backgroundColor:colors.gray100},
  helpfulText:{...type.label,color:colors.dark,fontWeight:'600'},
  missText:{...type.label,color:colors.gray600,fontWeight:'600'},
  reward:{marginTop:spacing.x4,padding:spacing.x3,flexDirection:'row',alignItems:'center',gap:spacing.x3,borderRadius:radius.lg,backgroundColor:colors.limeSoft},
  rewardCoin:{width:48,height:48,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.white},
  rewardTitle:{...type.label,color:colors.dark,fontWeight:'600'},
  rewardText:{...type.caption,color:colors.gray600,marginTop:2},
  modalBackdrop:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:layout.gutter,backgroundColor:'rgba(255,255,255,.68)'},
  modalCard:{width:'100%',padding:spacing.x5,borderRadius:radius.md,backgroundColor:colors.white,...shadow},
  modalHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},
  modalTitle:{...type.label,color:colors.dark,fontWeight:'600'},
  modalCaption:{fontSize:10,lineHeight:15,color:colors.gray400,marginTop:spacing.x1},
  modalClose:{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#D3D6DA'},
  payPanel:{marginTop:spacing.x4,padding:spacing.x4,alignItems:'center',borderWidth:1,borderColor:colors.lime,borderRadius:radius.md},
  coinImage:{width:76,height:76,resizeMode:'contain'},
  payMessage:{fontSize:16,lineHeight:24,fontWeight:'500',textAlign:'center',color:colors.dark,marginVertical:spacing.x4},
  chatModalCard:{width:'100%',padding:spacing.x6,borderRadius:radius.lg,backgroundColor:colors.white,...shadow},
  chatIllustration:{width:150,height:150,resizeMode:'contain',alignSelf:'center'},
  chatStart:{height:52,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.lime,borderRadius:radius.md},
  chatStartText:{...type.label,color:'#91A700',fontWeight:'600'},
});
