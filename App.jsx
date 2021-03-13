import React from 'react';
import { TextInput, StyleSheet, KeyboardAvoidingView, FlatList, View, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { Container, Text, List, ListItem, Left, Right, Body, Thumbnail, Input, Item } from 'native-base';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

import WatchParty from './src/components/WatchParty';

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isReady: false,
    };
  }

  async componentDidMount() {
    await Font.loadAsync({
      Roboto: require('native-base/Fonts/Roboto.ttf'),
      Roboto_medium: require('native-base/Fonts/Roboto_medium.ttf'),
      ...Ionicons.font,
    });
    this.setState({ isReady: true });
  }


  render() {
    if (!this.state.isReady) {
      return <ActivityIndicator size="large" />;
    }

    return (
      <Container>
        <StatusBar
          backgroundColor="#af0faa"
          barStyle='light-content'/>
        <View style={styles.video}></View>
        <WatchParty/>
      </Container>
    );
  }
}

const styles = StyleSheet.create({
  video: {
    height: 200,
    backgroundColor: '#123',
  }
});
